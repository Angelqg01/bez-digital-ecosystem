import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import http from '../services/http';
import SocialFeedLayout from './social-feed/SocialFeedLayout';
import { mixFeedContent } from '../utils/feedMixer';

const SocialFeed = ({
  postContract,
  socialInteractionsContract,
  userProfileContract,
  wsConnection
}) => {
  const { user, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Mock data for Reels, Ads, and NFTs (since they are not fetched yet)
  const [reels] = useState([
    { id: 'r1', userName: 'CryptoArtist', userAvatar: 'https://i.pravatar.cc/150?u=r1', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4', likes: 120, comments: 45, description: 'Creating digital art 🎨 #nft #art' },
    { id: 'r2', userName: 'Web3Dev', userAvatar: 'https://i.pravatar.cc/150?u=r2', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-1173-large.mp4', likes: 89, comments: 12, description: 'Coding the future 🚀 #web3 #coding' }
  ]);

  const [ads] = useState([
    { id: 'a1', title: 'BeZhas Premium', description: 'Unlock exclusive features now!', image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="300"%3E%3Cdefs%3E%3ClinearGradient id="g" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%234F46E5;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%238B5CF6;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23g)" width="600" height="300"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dy=".3em"%3EBeZhas Premium%3C/text%3E%3C/svg%3E' },
    { id: 'a2', title: 'Crypto Wallet', description: 'Secure your assets.', image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="300"%3E%3Cdefs%3E%3ClinearGradient id="g" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%2310B981;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%2306B6D4;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23g)" width="600" height="300"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dy=".3em"%3ECrypto Wallet%3C/text%3E%3C/svg%3E' }
  ]);

  const [nfts] = useState([
    { id: 'n1', tokenId: '101', name: 'Cosmic Cube', price: '0.5', image: 'https://picsum.photos/300/300?random=nft1' },
    { id: 'n2', tokenId: '102', name: 'Digital Punk', price: '1.2', image: 'https://picsum.photos/300/300?random=nft2' }
  ]);

  useEffect(() => {
    if (isAuthenticated && postContract && socialInteractionsContract) {
      loadPosts();
      setupEventListeners();
    }
  }, [isAuthenticated, postContract, socialInteractionsContract]);

  const setupEventListeners = () => {
    if (!postContract || !socialInteractionsContract) return;

    // Listen for new posts
    postContract.on('PostCreated', (postId, author, content, timestamp) => {
      loadPosts(); // Refresh posts
    });

    // Listen for likes
    socialInteractionsContract.on('PostLiked', (postId, user, timestamp) => {
      updatePostStats(postId);
    });

    // Listen for comments
    socialInteractionsContract.on('CommentCreated', (postId, commentId, author, content, parentCommentId) => {
      updatePostStats(postId);
    });

    return () => {
      postContract.removeAllListeners();
      socialInteractionsContract.removeAllListeners();
    };
  };

  const loadPosts = async () => {
    try {
      setLoading(true);
      const fetchedPosts = [];

      // 1. Fetch from Blockchain
      if (postContract) {
        try {
          const postCount = await postContract.getTotalPosts();
          for (let i = 1; i <= postCount; i++) {
            const post = await postContract.posts(i);
            const [authorUsername] = await userProfileContract.getProfile(post.author);
            const stats = await socialInteractionsContract.getPostStats(i);
            const hasLiked = await socialInteractionsContract.hasUserLikedPost(i, user?.address || '0x0');

            fetchedPosts.push({
              id: i,
              author: post.author,
              authorUsername: authorUsername || 'Anonymous',
              content: post.content,
              timestamp: Number(post.timestamp) * 1000,
              likes: Number(stats.likes),
              comments: Number(stats.comments),
              shares: Number(stats.shares),
              hasLiked,
              isOwner: post.author.toLowerCase() === user?.address?.toLowerCase(),
              source: 'blockchain'
            });
          }
        } catch (err) {
          console.error("Blockchain fetch error", err);
        }
      }

      // 2. Fetch from Backend (News + Demo Posts)
      try {
        const newsResponse = await http.get('/posts');
        // Ensure we are accessing the correct property from the response
        const newsData = newsResponse.data?.posts || newsResponse.data || [];

        const newsPosts = (Array.isArray(newsData) ? newsData : []).map(p => ({
          id: p.id,
          author: p.author,
          authorUsername: 'NewsBot',
          content: p.content,
          timestamp: new Date(p.timestamp).getTime(),
          likes: p.likes || 0,
          comments: p.comments || 0,
          shares: p.shares || 0,
          hasLiked: false,
          isOwner: false,
          externalUrl: p.externalUrl,
          source: p.source || 'backend'
        }));
        fetchedPosts.push(...newsPosts);
      } catch (err) {
        console.error("Backend fetch error", err);
      }

      // Sort by timestamp descending
      fetchedPosts.sort((a, b) => b.timestamp - a.timestamp);

      setPosts(fetchedPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePostStats = async (postId) => {
    try {
      const stats = await socialInteractionsContract.getPostStats(postId);
      const hasLiked = await socialInteractionsContract.hasUserLikedPost(postId, user?.address || '0x0');

      setPosts(prev => prev.map(post =>
        post.id === Number(postId) ? {
          ...post,
          likes: Number(stats.likes),
          comments: Number(stats.comments),
          shares: Number(stats.shares),
          hasLiked
        } : post
      ));
    } catch (error) {
      console.error('Error updating post stats:', error);
    }
  };

  const createPost = async (postContent) => {
    if (!postContract || !postContent.trim()) return;

    try {
      setLoading(true);
      const tx = await postContract.createPost(postContent.trim());
      await tx.wait();

      // Broadcast new post via WebSocket
      if (wsConnection) {
        wsConnection.send(JSON.stringify({
          type: 'social_update',
          updateType: 'new_post',
          data: {
            author: user.address,
            content: postContent.trim()
          }
        }));
      }

      toast.success('Post created successfully!');
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error(`Error creating post: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (postId) => {
    if (!socialInteractionsContract) return;

    try {
      const tx = await socialInteractionsContract.togglePostLike(postId);
      await tx.wait();
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error(`Error: ${error.message}`);
    }
  };

  const createComment = async (postId, commentText) => {
    if (!socialInteractionsContract || !commentText?.trim()) return;

    try {
      const tx = await socialInteractionsContract.createComment(postId, commentText.trim(), 0);
      await tx.wait();
      toast.success('Comment posted successfully!');
    } catch (error) {
      console.error('Error creating comment:', error);
      toast.error(`Error posting comment: ${error.message}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="social-feed-placeholder">
        <p>Please connect your wallet to view the social feed</p>
      </div>
    );
  }

  return (
    <SocialFeedLayout
      user={user}
      posts={posts}
      reels={reels}
      ads={ads}
      nfts={nfts}
      onCreatePost={createPost}
      onLike={toggleLike}
      onComment={createComment}
    />
  );
};

export default SocialFeed;