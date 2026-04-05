# ☁️ BeZhas Cloud Architecture on Google Cloud Platform

**Project:** BeZhas - Decentralized Social Marketplace  
**Version:** 1.0  
**Date:** December 13, 2025

---

## 🏗️ High-Level Architecture

This document outlines the proposed infrastructure for deploying BeZhas on Google Cloud Platform (GCP). The architecture is designed for **high availability**, **auto-scalability**, and **bank-grade security**, leveraging GCP's managed services to minimize operational overhead.

### System Diagram

```mermaid
graph TD
    %% Users
    User([👤 User / Client])
    Mobile([📱 Mobile App])
    
    %% Entry Point
    subgraph "Google Cloud Network Edge"
        GLB[🌐 Global Load Balancer]
        Armor[🛡️ Cloud Armor WAF]
    end

    %% Compute Layer
    subgraph "Compute Layer (Serverless & Containerized)"
        subgraph "Cloud Run (Auto-scale)"
            Frontend[💻 Frontend Container<br/>(React + Nginx)]
            API[⚙️ Backend API<br/>(Node.js Express)]
        end
        
        subgraph "Google Kubernetes Engine (GKE)"
            Chat[💬 Chat Server Cluster<br/>(Socket.IO + Redis Adapter)]
            Agents[🤖 AI Agents Service]
        end
    end

    %% Data & State Layer
    subgraph "Data Persistence Layer"
        Redis[(🚀 Cloud Memorystore<br/>Redis Cache & Pub/Sub)]
        Mongo[(fw-database<br/>MongoDB Atlas)]
        Storage[📦 Cloud Storage<br/>Media & Assets]
    end

    %% Web3 Layer
    subgraph "Web3 Infrastructure"
        RPC[🔗 Google Blockchain Node Engine<br/>Polygon PoS Node]
        SmartContracts[📜 Polygon Smart Contracts]
    end

    %% External Services
    subgraph "External Integrations"
        Vertex[🧠 Vertex AI<br/>(Future Integration)]
        Discord[📢 Discord Webhooks<br/>(Security Alerts)]
    end

    %% Connections
    User --> GLB
    Mobile --> GLB
    GLB --> Armor
    Armor --> Frontend
    Armor --> API
    Armor --> Chat

    Frontend --> API
    Frontend --> Chat
    
    API --> Mongo
    API --> Redis
    API --> RPC
    API --> Storage
    API --> Discord
    
    Chat --> Redis
    Chat --> Mongo
    
    Agents --> Vertex
    Agents --> Chat

    RPC <--> SmartContracts
```

---

## 🧩 Component Breakdown

### 1. Entry Point & Security
*   **Global Load Balancer (GLB):** Distributes incoming traffic across the nearest available regions, ensuring low latency for global users.
*   **Cloud Armor:** Provides DDoS protection and Web Application Firewall (WAF) rules to block malicious traffic (SQL injection, XSS) before it reaches our servers.

### 2. Compute Layer
*   **Cloud Run (Frontend & API):**
    *   **Why:** Serverless container execution allows us to scale to zero when idle (saving costs) and scale up instantly during traffic spikes.
    *   **Frontend:** Dockerized React application served via Nginx.
    *   **Backend API:** Stateless Node.js REST API.
*   **Google Kubernetes Engine (GKE) (Chat & Real-time):**
    *   **Why:** WebSocket connections require long-lived stateful connections. GKE provides the orchestration needed for the Socket.IO cluster with session affinity.

### 3. Data & Caching
*   **Cloud Memorystore (Redis):**
    *   **Role:** Acts as the "glue" for the distributed system.
    *   **Usage:**
        *   **Session Store:** Manages user authentication sessions.
        *   **Pub/Sub:** Synchronizes chat messages across multiple GKE pods.
        *   **Rate Limiting:** Tracks API usage quotas in real-time.
*   **MongoDB Atlas (on GCP):**
    *   **Role:** Primary transactional database.
    *   **Usage:** Stores user profiles, social graph, and encrypted sensitive data.
*   **Cloud Storage:**
    *   **Role:** Object storage for user-generated content (images, videos) and NFT metadata backups.

### 4. Web3 Infrastructure
*   **Google Blockchain Node Engine:**
    *   **Role:** Dedicated RPC node for Polygon.
    *   **Benefit:** Provides a private, low-latency gateway to the blockchain, avoiding public RPC rate limits and ensuring faster transaction broadcasting for our users.

---

## 🚀 Scalability Strategy

| Component | Scaling Trigger | Strategy |
| :--- | :--- | :--- |
| **Frontend/API** | CPU > 60% or Request Latency | **Cloud Run Auto-scaling:** Spawns new container instances automatically (up to 1000+). |
| **Chat Server** | Active Connections | **GKE Horizontal Pod Autoscaler:** Adds more pods to the cluster as concurrent users increase. |
| **Database** | Storage/IOPS | **Atlas Auto-scale:** Automatically increases storage and compute tier without downtime. |

---

## 🔒 Security & Compliance

*   **Encryption at Rest:** All data in MongoDB and Cloud Storage is encrypted using AES-256.
*   **Encryption in Transit:** TLS 1.3 enforced from the Load Balancer down to the application.
*   **Secret Management:** API keys (Stripe, Google, Polygon) are stored in **GCP Secret Manager**, never in code.
*   **Identity:** **Cloud IAM** enforces "Least Privilege" access for all service accounts.

---

## 💰 Estimated Cloud Budget (Start Tier)

*   **Compute (Cloud Run + GKE):** ~$200/mo
*   **Database (Mongo + Redis):** ~$200/mo
*   **Blockchain Node:** ~$500/mo (Often subsidized by Google Web3 grants)
*   **Networking & Security:** ~$100/mo
*   **Total Ask:** **$1,000 - $1,500 / month** in Google Cloud Credits.
