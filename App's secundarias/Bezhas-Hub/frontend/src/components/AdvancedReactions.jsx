import { useState, useEffect } from 'react';

const AdvancedReactions = ({ postId, commentId, contracts, user, onReactionUpdate }) => {
  const [reactions, setReactions] = useState({
    like: 0,
    love: 0,
    laugh: 0,
    wow: 0,
    sad: 0,
    angry: 0,
    celebrate: 0,
    support: 0
  });
  const [userReaction, setUserReaction] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const reactionEmojis = {
    like: '👍',
    love: '❤️',
    laugh: '😂',
    wow: '😮',
    sad: '😢',
    angry: '😠',
    celebrate: '🎉',
    support: '🤝'
  };

  const reactionLabels = {
    like: 'Like',
    love: 'Love',
    laugh: 'Laugh',
    wow: 'Wow',
    sad: 'Sad',
    angry: 'Angry',
    celebrate: 'Celebrate',
    support: 'Support'
  };

  useEffect(() => {
    if (contracts?.advancedSocialInteractions && (postId || commentId)) {
      loadReactions();
    }
  }, [contracts, postId, commentId, user]);

  const loadReactions = async () => {
    try {
      if (postId) {
        const reactionCounts = await contracts.advancedSocialInteractions.getPostReactions(postId);
        setReactions({
          like: Number(reactionCounts.likes),
          love: Number(reactionCounts.loves),
          laugh: Number(reactionCounts.laughs),
          wow: Number(reactionCounts.wows),
          sad: Number(reactionCounts.sads),
          angry: Number(reactionCounts.angrys),
          celebrate: Number(reactionCounts.celebrates),
          support: Number(reactionCounts.supports)
        });

        // Get user's current reaction
        if (user?.address) {
          const currentReaction = await contracts.advancedSocialInteractions.postReactions(postId, user.address);
          setUserReaction(currentReaction > 0 ? Object.keys(reactionEmojis)[currentReaction] : null);
        }
      } else if (commentId) {
        // Similar logic for comments
        const currentReaction = await contracts.advancedSocialInteractions.commentReactions(commentId, user.address);
        setUserReaction(currentReaction > 0 ? Object.keys(reactionEmojis)[currentReaction] : null);
      }
    } catch (error) {
      console.error('Error loading reactions:', error);
    }
  };

  const handleReaction = async (reactionType) => {
    if (!user?.address || loading) return;

    setLoading(true);
    try {
      if (postId) {
        if (userReaction === reactionType) {
          // Remove reaction
          await contracts.advancedSocialInteractions.removePostReaction(postId);
          setUserReaction(null);
          setReactions(prev => ({
            ...prev,
            [reactionType]: Math.max(0, prev[reactionType] - 1)
          }));
        } else {
          // Add or change reaction
          const reactionIndex = Object.keys(reactionEmojis).indexOf(reactionType);
          await contracts.advancedSocialInteractions.reactToPost(postId, reactionIndex);
          
          // Update counts
          setReactions(prev => {
            const newReactions = { ...prev };
            if (userReaction) {
              newReactions[userReaction] = Math.max(0, newReactions[userReaction] - 1);
            }
            newReactions[reactionType] = newReactions[reactionType] + 1;
            return newReactions;
          });
          setUserReaction(reactionType);
        }
      } else if (commentId) {
        const reactionIndex = Object.keys(reactionEmojis).indexOf(reactionType);
        await contracts.advancedSocialInteractions.reactToComment(commentId, reactionIndex);
        setUserReaction(reactionType);
      }

      setShowReactionPicker(false);
      
      if (onReactionUpdate) {
        onReactionUpdate(postId || commentId, reactionType);
      }
    } catch (error) {
      console.error('Error updating reaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalReactions = () => {
    return Object.values(reactions).reduce((sum, count) => sum + count, 0);
  };

  const getTopReactions = () => {
    return Object.entries(reactions)
      .filter(([_, count]) => count > 0)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 3);
  };

  return (
    <div className="advanced-reactions">
      <div className="reaction-summary">
        {getTopReactions().map(([type, count]) => (
          <span key={type} className="reaction-emoji-count">
            {reactionEmojis[type]} {count}
          </span>
        ))}
        {getTotalReactions() > 0 && (
          <span className="total-reactions">
            {getTotalReactions()} reaction{getTotalReactions() !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="reaction-controls">
        <div className="reaction-picker-container">
          <button
            className={`main-reaction-btn ${userReaction ? 'reacted' : ''}`}
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            disabled={loading}
          >
            {userReaction ? (
              <>
                {reactionEmojis[userReaction]} {reactionLabels[userReaction]}
              </>
            ) : (
              <>👍 Like</>
            )}
          </button>

          {showReactionPicker && (
            <div className="reaction-picker">
              {Object.entries(reactionEmojis).map(([type, emoji]) => (
                <button
                  key={type}
                  className={`reaction-option ${userReaction === type ? 'selected' : ''}`}
                  onClick={() => handleReaction(type)}
                  title={reactionLabels[type]}
                  disabled={loading}
                >
                  <span className="reaction-emoji">{emoji}</span>
                  <span className="reaction-label">{reactionLabels[type]}</span>
                  {reactions[type] > 0 && (
                    <span className="reaction-count">{reactions[type]}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="comment-btn">
          💬 Comment
        </button>

        <button className="share-btn">
          🔄 Share
        </button>
      </div>

      {loading && (
        <div className="reaction-loading">
          <span>Updating reaction...</span>
        </div>
      )}
    </div>
  );
};

export default AdvancedReactions;
