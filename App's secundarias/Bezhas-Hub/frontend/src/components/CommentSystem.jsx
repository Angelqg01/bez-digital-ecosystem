import { useState, useEffect } from 'react';
import AdvancedReactions from './AdvancedReactions';

const CommentSystem = ({ postId, contracts, user, wsConnection }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showReplies, setShowReplies] = useState({});

  useEffect(() => {
    if (contracts?.advancedSocialInteractions && postId) {
      loadComments();
    }
  }, [contracts, postId]);

  const loadComments = async () => {
    if (!contracts?.advancedSocialInteractions || loading) return;

    setLoading(true);
    try {
      const commentsData = await contracts.advancedSocialInteractions.getPostComments(
        postId, 
        page * 10, 
        10
      );
      
      const formattedComments = commentsData.map(comment => ({
        id: Number(comment.id),
        postId: Number(comment.postId),
        parentCommentId: Number(comment.parentCommentId),
        author: comment.author,
        content: comment.content,
        hashtags: comment.hashtags,
        mentions: comment.mentions,
        timestamp: Number(comment.timestamp) * 1000,
        isDeleted: comment.isDeleted,
        isModerated: comment.isModerated,
        likesCount: Number(comment.likesCount),
        repliesCount: Number(comment.repliesCount)
      }));

      if (page === 0) {
        setComments(formattedComments);
      } else {
        setComments(prev => [...prev, ...formattedComments]);
      }
      
      setHasMore(formattedComments.length === 10);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReplies = async (commentId) => {
    try {
      const repliesData = await contracts.advancedSocialInteractions.getCommentReplies(
        commentId,
        0,
        20
      );
      
      const formattedReplies = repliesData.map(reply => ({
        id: Number(reply.id),
        postId: Number(reply.postId),
        parentCommentId: Number(reply.parentCommentId),
        author: reply.author,
        content: reply.content,
        hashtags: reply.hashtags,
        mentions: reply.mentions,
        timestamp: Number(reply.timestamp) * 1000,
        isDeleted: reply.isDeleted,
        isModerated: reply.isModerated,
        likesCount: Number(reply.likesCount),
        repliesCount: Number(reply.repliesCount)
      }));

      setComments(prev => {
        const updated = [...prev];
        const parentIndex = updated.findIndex(c => c.id === commentId);
        if (parentIndex !== -1) {
          updated[parentIndex].replies = formattedReplies;
        }
        return updated;
      });

      setShowReplies(prev => ({ ...prev, [commentId]: true }));
    } catch (error) {
      console.error('Error loading replies:', error);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !user?.address || loading) return;

    setLoading(true);
    try {
      const hashtags = extractHashtags(newComment);
      const mentions = extractMentions(newComment);

      await contracts.advancedSocialInteractions.createComment(
        postId,
        replyingTo || 0,
        newComment,
        hashtags,
        mentions
      );

      setNewComment('');
      setReplyingTo(null);
      
      // Reload comments to show the new one
      setPage(0);
      await loadComments();
      
      // Send WebSocket notification
      if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify({
          type: 'comment_created',
          data: {
            postId,
            author: user.address,
            content: newComment,
            parentCommentId: replyingTo
          }
        }));
      }
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (commentId) => {
    if (!user?.address || loading) return;

    try {
      await contracts.advancedSocialInteractions.deleteComment(commentId);
      
      setComments(prev => 
        prev.map(comment => 
          comment.id === commentId 
            ? { ...comment, isDeleted: true, content: '[Deleted]' }
            : comment
        )
      );
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const extractHashtags = (text) => {
    const hashtagRegex = /#[\w]+/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  };

  const extractMentions = (text) => {
    const mentionRegex = /@(0x[a-fA-F0-9]{40})/g;
    const matches = text.match(mentionRegex);
    return matches ? matches.map(mention => mention.substring(1)) : [];
  };

  /**
   * Formato seguro de contenido sin dangerouslySetInnerHTML
   * Convierte texto con hashtags y menciones en elementos React
   */
  const formatContentSafe = (content) => {
    const parts = [];
    let lastIndex = 0;
    
    // Regex combinado para hashtags y menciones
    const regex = /(#[\w]+)|(@0x[a-fA-F0-9]{40})/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      // Añadir texto antes del match
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      
      // Añadir el hashtag o mención formateado
      if (match[0].startsWith('#')) {
        parts.push(<span key={match.index} className="hashtag">{match[0]}</span>);
      } else {
        parts.push(<span key={match.index} className="mention">{match[0]}</span>);
      }
      
      lastIndex = regex.lastIndex;
    }
    
    // Añadir el resto del texto
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : content;
  };

  const formatTimestamp = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const Comment = ({ comment, isReply = false }) => (
    <div className={`comment ${isReply ? 'reply' : ''} ${comment.isDeleted ? 'deleted' : ''}`}>
      <div className="comment-header">
        <div className="comment-author">
          <span className="author-address">{comment.author.slice(0, 6)}...{comment.author.slice(-4)}</span>
          <span className="comment-time">{formatTimestamp(comment.timestamp)}</span>
        </div>
        {comment.author === user?.address && !comment.isDeleted && (
          <button 
            className="delete-comment-btn"
            onClick={() => deleteComment(comment.id)}
          >
            🗑️
          </button>
        )}
      </div>

      <div className="comment-content">
        {comment.isDeleted ? (
          <span className="deleted-content">[This comment has been deleted]</span>
        ) : (
          <div className="comment-text">
            {formatContentSafe(comment.content)}
          </div>
        )}
      </div>

      {!comment.isDeleted && (
        <>
          <AdvancedReactions 
            commentId={comment.id}
            contracts={contracts}
            user={user}
          />

          <div className="comment-actions">
            {!isReply && (
              <button 
                className="reply-btn"
                onClick={() => setReplyingTo(comment.id)}
              >
                Reply
              </button>
            )}
            
            {comment.repliesCount > 0 && !isReply && (
              <button 
                className="show-replies-btn"
                onClick={() => {
                  if (showReplies[comment.id]) {
                    setShowReplies(prev => ({ ...prev, [comment.id]: false }));
                  } else {
                    loadReplies(comment.id);
                  }
                }}
              >
                {showReplies[comment.id] ? 'Hide' : 'Show'} {comment.repliesCount} repl{comment.repliesCount === 1 ? 'y' : 'ies'}
              </button>
            )}
          </div>

          {showReplies[comment.id] && comment.replies && (
            <div className="replies">
              {comment.replies.map(reply => (
                <Comment key={reply.id} comment={reply} isReply={true} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="comment-system">
      <div className="comment-form">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
          className="comment-input"
          rows={3}
        />
        
        <div className="comment-form-actions">
          {replyingTo && (
            <button 
              className="cancel-reply-btn"
              onClick={() => setReplyingTo(null)}
            >
              Cancel Reply
            </button>
          )}
          
          <button 
            className="submit-comment-btn"
            onClick={submitComment}
            disabled={!newComment.trim() || loading}
          >
            {loading ? 'Posting...' : (replyingTo ? 'Reply' : 'Comment')}
          </button>
        </div>

        <div className="comment-help">
          <small>
            Use #hashtags and @0x... to mention users
          </small>
        </div>
      </div>

      <div className="comments-list">
        {comments.filter(c => c.parentCommentId === 0).map(comment => (
          <Comment key={comment.id} comment={comment} />
        ))}
        
        {hasMore && (
          <button 
            className="load-more-comments-btn"
            onClick={() => {
              setPage(prev => prev + 1);
              loadComments();
            }}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More Comments'}
          </button>
        )}
      </div>
    </div>
  );
};

export default CommentSystem;
