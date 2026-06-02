import { useState, useEffect } from 'react';

const ShareSystem = ({ postId, contracts, user, wsConnection, onShareUpdate }) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareComment, setShareComment] = useState('');
  const [shares, setShares] = useState([]);
  const [shareCount, setShareCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (contracts?.advancedSocialInteractions && postId) {
      loadShares();
    }
  }, [contracts, postId]);

  const loadShares = async () => {
    try {
      // This would load shares from the contract
      // For now, we'll use a placeholder
      setShareCount(0);
      setShares([]);
    } catch (error) {
      console.error('Error loading shares:', error);
    }
  };

  const sharePost = async () => {
    if (!user?.address || loading) return;

    setLoading(true);
    try {
      const hashtags = extractHashtags(shareComment);
      const mentions = extractMentions(shareComment);

      await contracts.advancedSocialInteractions.sharePost(
        postId,
        shareComment,
        hashtags,
        mentions
      );

      setShareComment('');
      setShowShareModal(false);
      setShareCount(prev => prev + 1);

      // Send WebSocket notification
      if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify({
          type: 'post_shared',
          data: {
            originalPostId: postId,
            sharer: user.address,
            comment: shareComment
          }
        }));
      }

      if (onShareUpdate) {
        onShareUpdate(postId);
      }
    } catch (error) {
      console.error('Error sharing post:', error);
    } finally {
      setLoading(false);
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

  return (
    <div className="share-system">
      <button 
        className="share-btn"
        onClick={() => setShowShareModal(true)}
      >
        🔄 Share {shareCount > 0 && `(${shareCount})`}
      </button>

      {showShareModal && (
        <div className="share-modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <h3>Share Post</h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowShareModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="share-modal-content">
              <textarea
                value={shareComment}
                onChange={(e) => setShareComment(e.target.value)}
                placeholder="Add a comment to your share (optional)..."
                className="share-comment-input"
                rows={3}
              />

              <div className="share-help">
                <small>Use #hashtags and @0x... to mention users</small>
              </div>

              <div className="share-options">
                <div className="share-option">
                  <input type="checkbox" id="share-to-feed" defaultChecked />
                  <label htmlFor="share-to-feed">Share to your feed</label>
                </div>
              </div>
            </div>

            <div className="share-modal-actions">
              <button 
                className="cancel-share-btn"
                onClick={() => setShowShareModal(false)}
              >
                Cancel
              </button>
              <button 
                className="confirm-share-btn"
                onClick={sharePost}
                disabled={loading}
              >
                {loading ? 'Sharing...' : 'Share Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareSystem;
