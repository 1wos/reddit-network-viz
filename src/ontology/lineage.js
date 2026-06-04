/**
 * Ontology — Lineage tracer
 *
 * Follows the EVIDENCED_BY backbone from a signal/entity down to its source
 * RedditPosts, then to their Authors and Subreddits and the ingesting backing
 * dataset — the "why does this exist / where did it come from" view.
 */

export function traceLineage(store, id) {
  const root = store.get(id);
  if (!root) return null;

  const postLinks = store.getLinks({ type: "EVIDENCED_BY", source: id });
  const posts = postLinks.map((l) => {
    const post = store.get(l.target);
    if (!post) return null;
    const author = store.getLinks({ type: "AUTHORED_BY", source: post.id }).map((x) => store.get(x.target))[0] || null;
    const sub = store.getLinks({ type: "POSTED_IN", source: post.id }).map((x) => store.get(x.target))[0] || null;
    return {
      postId: post.id, title: post.title, snippet: post.body, sentiment: post.sentiment, score: post.score,
      author: author?.username || null, subreddit: sub?.name || null, backingDataset: post.__backingDataset,
    };
  }).filter(Boolean);

  return {
    id, label: root.label || root.name || id, type: root.__type,
    backingDataset: root.__backingDataset,
    sourceRefs: root.__sourceRefs || [],
    evidenceCount: posts.length,
    posts,
    subreddits: [...new Set(posts.map((p) => p.subreddit).filter(Boolean))],
    authors: [...new Set(posts.map((p) => p.author).filter(Boolean))],
  };
}
