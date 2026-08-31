import { useState, useEffect, useRef } from 'react';
import http from '../services/http';
import { ethers } from 'ethers';

const CommunicationHub = ({
  provider,
  signer,
  account,
  communicationContract,
  onError
}) => {
  const [activeTab, setActiveTab] = useState('groups');
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCall, setActiveCall] = useState(null);
  const [fileUpload, setFileUpload] = useState(null);

  // WebRTC refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  // Group creation form
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    isPrivate: false,
    maxMembers: 50
  });

  useEffect(() => {
    if (communicationContract && account) {
      loadUserGroups();
    }
  }, [communicationContract, account]);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupMessages();
    }
  }, [selectedGroup]);

  const loadUserGroups = async () => {
    try {
      setIsLoading(true);
      const userGroupIds = await communicationContract.getUserGroups(account);
      const groupsData = [];

      for (let groupId of userGroupIds) {
        const group = await communicationContract.groupChats(groupId);
        if (group.isActive) {
          groupsData.push({
            id: groupId.toString(),
            name: group.name,
            description: group.description,
            creator: group.creator,
            isPrivate: group.isPrivate,
            memberCount: group.members?.length || 0,
            createdAt: new Date(group.createdAt.toNumber() * 1000)
          });
        }
      }

      setGroups(groupsData);
    } catch (error) {
      console.error('Error loading groups:', error);
      onError('Failed to load groups');
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroupMessages = async () => {
    if (!selectedGroup) return;

    try {
      setIsLoading(true);
      const messageIds = await communicationContract.getGroupMessages(
        selectedGroup.id,
        0,
        100
      );

      const messagesData = [];
      for (let messageId of messageIds) {
        const messageDetails = await communicationContract.getMessageDetails(messageId);
        const message = {
          id: messageId.toString(),
          groupId: messageDetails.groupId.toString(),
          sender: messageDetails.sender,
          content: messageDetails.content,
          timestamp: new Date(messageDetails.timestamp.toNumber() * 1000),
          messageType: messageDetails.messageType,
          attachmentHash: messageDetails.attachmentHash,
          isDeleted: messageDetails.isDeleted
        };

        if (!message.isDeleted) {
          messagesData.push(message);
        }
      }

      setMessages(messagesData.sort((a, b) => a.timestamp - b.timestamp));
    } catch (error) {
      console.error('Error loading messages:', error);
      onError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const createGroup = async () => {
    if (!groupForm.name.trim()) {
      onError('Group name is required');
      return;
    }

    try {
      setIsLoading(true);
      const tx = await communicationContract.createGroupChat(
        groupForm.name,
        groupForm.description,
        groupForm.isPrivate,
        groupForm.maxMembers
      );

      await tx.wait();

      setGroupForm({
        name: '',
        description: '',
        isPrivate: false,
        maxMembers: 50
      });

      await loadUserGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      onError('Failed to create group');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedGroup || (!newMessage.trim() && !fileUpload)) {
      return;
    }

    try {
      setIsLoading(true);
      let attachmentHash = '';
      let messageType = 0; // TEXT

      if (fileUpload) {
        // Upload file to IPFS (placeholder - implement IPFS upload)
        attachmentHash = await uploadToIPFS(fileUpload);
        messageType = getMessageTypeFromFile(fileUpload);
      }

      const tx = await communicationContract.sendMessage(
        selectedGroup.id,
        newMessage,
        messageType,
        attachmentHash
      );

      await tx.wait();

      setNewMessage('');
      setFileUpload(null);
      await loadGroupMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      onError('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadToIPFS = async (file) => {
    // Placeholder for IPFS upload
    // In production, integrate with IPFS service
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await http.post('/api/upload-ipfs', formData);

      const result = response.data;

      // Register file in contract
      await communicationContract.uploadFile(
        result.hash,
        file.name,
        file.size,
        file.type
      );

      return result.hash;
    } catch (error) {
      console.error('IPFS upload error:', error);
      return '';
    }
  };

  const getMessageTypeFromFile = (file) => {
    if (file.type.startsWith('image/')) return 1; // IMAGE
    if (file.type.startsWith('audio/')) return 3; // VOICE
    if (file.type.startsWith('video/')) return 4; // VIDEO
    return 2; // FILE
  };

  const startVideoCall = async () => {
    if (!selectedGroup) return;

    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = peerConnection;

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Start call in contract
      const tx = await communicationContract.startCall(
        selectedGroup.id,
        1, // VIDEO
        JSON.stringify(offer)
      );

      const receipt = await tx.wait();
      const sessionId = receipt.events?.find(e => e.event === 'CallStarted')?.args?.sessionId;

      setActiveCall({
        sessionId: sessionId?.toString(),
        type: 'video',
        isInitiator: true
      });

    } catch (error) {
      console.error('Error starting video call:', error);
      onError('Failed to start video call');
    }
  };

  const startVoiceCall = async () => {
    if (!selectedGroup) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
      });

      localStreamRef.current = stream;

      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const tx = await communicationContract.startCall(
        selectedGroup.id,
        0, // VOICE
        JSON.stringify(offer)
      );

      const receipt = await tx.wait();
      const sessionId = receipt.events?.find(e => e.event === 'CallStarted')?.args?.sessionId;

      setActiveCall({
        sessionId: sessionId?.toString(),
        type: 'voice',
        isInitiator: true
      });

    } catch (error) {
      console.error('Error starting voice call:', error);
      onError('Failed to start voice call');
    }
  };

  const endCall = async () => {
    if (!activeCall) return;

    try {
      // End call in contract
      await communicationContract.endCall(activeCall.sessionId);

      // Clean up WebRTC
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      setActiveCall(null);
    } catch (error) {
      console.error('Error ending call:', error);
      onError('Failed to end call');
    }
  };

  const searchMessages = async () => {
    if (!selectedGroup || !searchTerm.trim()) return;

    try {
      const results = await communicationContract.searchMessages(
        selectedGroup.id,
        searchTerm,
        0,
        0
      );

      const searchResults = [];
      for (let messageId of results) {
        const messageDetails = await communicationContract.getMessageDetails(messageId);
        searchResults.push({
          id: messageId.toString(),
          content: messageDetails.content,
          sender: messageDetails.sender,
          timestamp: new Date(messageDetails.timestamp.toNumber() * 1000)
        });
      }

      setMessages(searchResults);
    } catch (error) {
      console.error('Error searching messages:', error);
      onError('Failed to search messages');
    }
  };

  const markMessageAsRead = async (messageId) => {
    try {
      await communicationContract.markMessageAsRead(messageId);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTimestamp = (timestamp) => {
    return timestamp.toLocaleString();
  };

  return (
    <div className="communication-hub">
      <div className="communication-header">
        <h2>💬 Communication Hub</h2>
        <div className="tab-navigation">
          <button
            className={activeTab === 'groups' ? 'active' : ''}
            onClick={() => setActiveTab('groups')}
          >
            Groups
          </button>
          <button
            className={activeTab === 'create' ? 'active' : ''}
            onClick={() => setActiveTab('create')}
          >
            Create Group
          </button>
        </div>
      </div>

      {activeTab === 'groups' && (
        <div className="groups-section">
          <div className="groups-sidebar">
            <h3>Your Groups</h3>
            <div className="groups-list">
              {groups.map(group => (
                <div
                  key={group.id}
                  className={`group-item ${selectedGroup?.id === group.id ? 'selected' : ''}`}
                  onClick={() => setSelectedGroup(group)}
                >
                  <div className="group-name">{group.name}</div>
                  <div className="group-info">
                    {group.memberCount} members
                    {group.isPrivate && <span className="private-badge">🔒</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedGroup && (
            <div className="chat-area">
              <div className="chat-header">
                <h3>{selectedGroup.name}</h3>
                <div className="chat-controls">
                  <button onClick={startVoiceCall} disabled={activeCall}>
                    🎤 Voice Call
                  </button>
                  <button onClick={startVideoCall} disabled={activeCall}>
                    📹 Video Call
                  </button>
                  {activeCall && (
                    <button onClick={endCall} className="end-call">
                      ❌ End Call
                    </button>
                  )}
                </div>
              </div>

              {activeCall && (
                <div className="call-area">
                  <div className="video-container">
                    {activeCall.type === 'video' && (
                      <>
                        <video ref={localVideoRef} autoPlay muted className="local-video" />
                        <video ref={remoteVideoRef} autoPlay className="remote-video" />
                      </>
                    )}
                    {activeCall.type === 'voice' && (
                      <div className="voice-call-indicator">
                        🎤 Voice Call Active
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="search-area">
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchMessages()}
                />
                <button onClick={searchMessages}>🔍</button>
                <button onClick={loadGroupMessages}>Clear</button>
              </div>

              <div className="messages-area">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`message ${message.sender === account ? 'own-message' : ''}`}
                    onClick={() => markMessageAsRead(message.id)}
                  >
                    <div className="message-header">
                      <span className="sender">{formatAddress(message.sender)}</span>
                      <span className="timestamp">{formatTimestamp(message.timestamp)}</span>
                    </div>
                    <div className="message-content">
                      {message.content}
                      {message.attachmentHash && (
                        <div className="attachment">
                          📎 Attachment: {message.attachmentHash}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="message-input-area">
                <input
                  type="file"
                  onChange={(e) => setFileUpload(e.target.files[0])}
                  style={{ display: 'none' }}
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="file-upload-btn">
                  📎
                </label>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage} disabled={isLoading}>
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <div className="create-group-section">
          <h3>Create New Group</h3>
          <div className="form-group">
            <label>Group Name *</label>
            <input
              type="text"
              value={groupForm.name}
              onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
              placeholder="Enter group name"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={groupForm.description}
              onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
              placeholder="Enter group description"
            />
          </div>

          <div className="form-group">
            <label>Max Members</label>
            <input
              type="number"
              value={groupForm.maxMembers}
              onChange={(e) => setGroupForm({ ...groupForm, maxMembers: parseInt(e.target.value) })}
              min="2"
              max="100"
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={groupForm.isPrivate}
                onChange={(e) => setGroupForm({ ...groupForm, isPrivate: e.target.checked })}
              />
              Private Group
            </label>
          </div>

          <button
            onClick={createGroup}
            disabled={isLoading || !groupForm.name.trim()}
            className="create-group-btn"
          >
            {isLoading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Loading...</div>
        </div>
      )}
    </div>
  );
};

export default CommunicationHub;
