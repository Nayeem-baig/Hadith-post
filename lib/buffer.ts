import type { BufferChannel, BufferPostRecord } from "@/types/studio";

export interface BufferPublishRequest {
  organizationId: string;
  accountIds: string[];
  caption?: string;
  title?: string;
  scheduledAt?: string;
  tags?: string[];
  saveToDraft?: boolean;
}

const BUFFER_API = "https://api.buffer.com";

export function bufferConfigured() {
  return Boolean(process.env.BUFFER_ACCESS_TOKEN);
}

export async function bufferGraphQL<T>(query: string, variables?: Record<string, unknown>) {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Buffer is not configured.");
  }
  const response = await fetch(BUFFER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || (payload && typeof payload === "object" && "errors" in payload)) {
    const error = payload && typeof payload === "object" && "errors" in payload ? payload : { error: "Buffer request failed." };
    throw new Error(JSON.stringify(error));
  }
  return payload as T;
}

export interface BufferOrganization {
  id: string;
  name: string;
}

export interface BufferBootstrapData {
  organizations: BufferOrganization[];
  channels: BufferChannel[];
  posts: BufferPostRecord[];
}

export async function getBufferBootstrap(organizationId?: string): Promise<BufferBootstrapData> {
  const orgResponse = await bufferGraphQL<{
    data: {
      account: {
        organizations: BufferOrganization[];
      };
    };
  }>(`
    query GetOrganizations {
      account {
        organizations {
          id
          name
        }
      }
    }
  `);
  const organizations = orgResponse.data.account.organizations || [];
  const resolvedOrgId = organizationId || organizations[0]?.id || "";
  if (!resolvedOrgId) {
    return { organizations, channels: [], posts: [] };
  }
  let channels: BufferChannel[] = [];
  let posts: BufferPostRecord[] = [];
  try {
    const channelResponse = await bufferGraphQL<{
      data: {
        channels: BufferChannel[];
      };
    }>(
      `
      query GetChannels($organizationId: OrganizationId!) {
        channels(input: { organizationId: $organizationId }) {
          id
          name
          service
          avatar
        }
      }
    `,
      { organizationId: resolvedOrgId }
    );
    channels = channelResponse.data.channels || [];
  } catch (error) {
    console.error("Buffer channel fetch failed:", error);
  }
  try {
    const postResponse = await bufferGraphQL<{
      data: {
        posts: {
          edges: Array<{
            node: BufferPostRecord & { mode?: string };
          }>;
        };
      };
    }>(
      `
      query GetPosts($organizationId: OrganizationId!, $first: Int) {
        posts(
          first: $first
          input: {
            organizationId: $organizationId
            filter: { status: [draft, scheduled, sent] }
          }
        ) {
          edges {
            node {
              id
              channelId
              text
              dueAt
              createdAt
              status
            }
          }
        }
      }
    `,
      { organizationId: resolvedOrgId, first: 50 }
    );
    posts = postResponse.data.posts.edges.map((edge) => edge.node);
  } catch (error) {
    console.error("Buffer post fetch failed:", error);
  }
  return {
    organizations,
    channels,
    posts
  };
}

export async function createBufferPost(input: {
  organizationId: string;
  channelId: string;
  text: string;
  scheduledAt?: string;
  saveToDraft?: boolean;
  assets?: Array<{
    image?: { url: string; metadata?: Record<string, unknown> };
    video?: {
      url: string;
      metadata?: {
        thumbnailOffset?: number;
        [key: string]: unknown;
      };
    };
  }>;
  metadata?: {
    youtube?: {
      title?: string;
      categoryId?: string;
      privacy?: string;
      license?: string;
      notifySubscribers?: boolean;
      embeddable?: boolean;
      madeForKids?: boolean;
      isAiGenerated?: boolean;
    };
  };
}) {
  if (input.saveToDraft) {
    const response = await bufferGraphQL<{
      data: {
        createPost:
          | {
              post: BufferPostRecord;
            }
          | { message: string };
      };
    }>(
      `
      mutation CreateDraftPost($channelId: ChannelId!, $text: String!, $assets: [AssetInput!], $metadata: PostInputMetaData) {
        createPost(input: { channelId: $channelId, text: $text, schedulingType: automatic, mode: addToQueue, saveToDraft: true, assets: $assets, metadata: $metadata }) {
          ... on PostActionSuccess {
            post { id text channelId dueAt status createdAt }
          }
          ... on MutationError { message }
        }
      }
    `,
      { channelId: input.channelId, text: input.text, assets: input.assets, metadata: input.metadata }
    );
    return response.data.createPost;
  }

  const mutation = input.scheduledAt
    ? `
      mutation CreateScheduledPost($channelId: ChannelId!, $text: String!, $dueAt: DateTime!, $assets: [AssetInput!], $metadata: PostInputMetaData) {
        createPost(input: { channelId: $channelId, text: $text, schedulingType: automatic, mode: customScheduled, dueAt: $dueAt, assets: $assets, metadata: $metadata }) {
          ... on PostActionSuccess { post { id text channelId dueAt status createdAt } }
          ... on MutationError { message }
        }
      }
    `
    : `
      mutation CreateQueuePost($channelId: ChannelId!, $text: String!, $assets: [AssetInput!], $metadata: PostInputMetaData) {
        createPost(input: { channelId: $channelId, text: $text, schedulingType: automatic, mode: addToQueue, assets: $assets, metadata: $metadata }) {
          ... on PostActionSuccess { post { id text channelId dueAt status createdAt } }
          ... on MutationError { message }
        }
      }
    `;
  const variables = input.scheduledAt
    ? { channelId: input.channelId, text: input.text, dueAt: input.scheduledAt, assets: input.assets, metadata: input.metadata }
    : { channelId: input.channelId, text: input.text, assets: input.assets, metadata: input.metadata };
  const response = await bufferGraphQL<{
    data: {
      createPost:
        | {
            post: BufferPostRecord;
          }
        | { message: string };
    };
  }>(mutation, variables);
  return response.data.createPost;
}
