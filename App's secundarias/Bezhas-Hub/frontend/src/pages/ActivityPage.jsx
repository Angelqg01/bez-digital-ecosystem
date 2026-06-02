import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import ActivityFeed from '../components/activity/ActivityFeed';
import './ActivityPage.css';

const ActivityPage = ({ 
  gamificationContract, 
  groupsContract, 
  governanceContract, 
  marketplaceContract, 
  userProfileContract 
}) => {
  const [activities, setActivities] = useState([
    {
      id: 1, type: 'quest_completed',
      user: 'amiyoe', 
      details: { quest: 'Maestro de la Comunidad', xp: 100 },
      timestamp: 'hace 5 minutos'
    }
  ]);

  useEffect(() => {
    const listeners = [];

    const setupListener = (contract, eventName, formatter) => {
      if (!contract) return;
      const listener = async (...args) => {
        const event = args[args.length - 1];
        const formattedActivity = await formatter(event.args);
        setActivities(prev => [formattedActivity, ...prev]);
      };
      contract.on(eventName, listener);
      listeners.push({ contract, eventName, listener });
    };

    // Formatters for each event
    const formatQuestCompleted = async (args) => ({
      id: Date.now(), type: 'quest_completed',
      user: (await userProfileContract.getProfile(args.user))[0] || args.user.slice(0, 6),
      details: { quest: `Desafío #${Number(args.challengeId)}`, xp: Number(args.points) },
      timestamp: new Date().toLocaleTimeString()
    });

    const formatNewMember = async (args) => ({
      id: Date.now(), type: 'new_member',
      user: (await userProfileContract.getProfile(args.member))[0] || args.member.slice(0, 6),
      details: { group: `Grupo #${Number(args.groupId)}` },
      timestamp: new Date().toLocaleTimeString()
    });

    const formatProposalCreated = async (args) => ({
      id: Date.now(), type: 'proposal_created',
      user: (await userProfileContract.getProfile(args.proposer))[0] || args.proposer.slice(0, 6),
      details: { group: `Gobernanza`, proposal: args.title },
      timestamp: new Date().toLocaleTimeString()
    });

    const formatItemSold = async (args) => ({
      id: Date.now(), type: 'item_sold',
      user: (await userProfileContract.getProfile(args.seller))[0] || args.seller.slice(0, 6),
      details: { item: `Item #${Number(args.listingId)}`, price: ethers.formatUnits(args.price, 18), buyer: (await userProfileContract.getProfile(args.buyer))[0] || args.buyer.slice(0, 6) },
      timestamp: new Date().toLocaleTimeString()
    });

    // Setup listeners
    setupListener(gamificationContract, 'ChallengeCompleted', formatQuestCompleted);
    setupListener(groupsContract, 'MemberJoined', formatNewMember);
    setupListener(governanceContract, 'ProposalCreated', formatProposalCreated);
    setupListener(marketplaceContract, 'ItemSold', formatItemSold);

    return () => {
      listeners.forEach(({ contract, eventName, listener }) => {
        contract.off(eventName, listener);
      });
    };
  }, [gamificationContract, groupsContract, governanceContract, marketplaceContract, userProfileContract]);

  return (
    <div className="activity-page">
      <header className="activity-header">
        <h1>Actividad de la Comunidad</h1>
        <p>El pulso en tiempo real de todo lo que sucede en BeZhas.</p>
      </header>

      <div className="activity-feed-container">
        <ActivityFeed activities={activities} />
      </div>
    </div>
  );
};

export default ActivityPage;
