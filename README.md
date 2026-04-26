# 📘 EduComm Backend (Next.js API)

## 🧠 Overview

EduComm Backend is the server-side component of the EduComm platform — a unified academic communication system designed to support real-time interaction, role-based access control, and AI-powered multilingual communication.

Built using **Next.js API routes**, this backend handles authentication, user management, messaging logic, and integration with external services such as a locally hosted translation engine.

---

## 🚀 Key Features

### 🔐 Authentication & Authorization

* Secure authentication using Firebase Admin SDK
* JWT-based request validation via Authorization headers
* Role-based access control (RBAC)
* Protected API endpoints

---

### 👤 User Management

* Fetch and manage user profiles from Firestore
* Update user details (name, username) with validation
* Enforce username uniqueness
* Role assignment and permission checks

---

### 💬 Messaging System (Core Logic)

* Backend support for messaging workflows
* Structured for group chats and private conversations
* Designed to support future real-time extensions

---

### 🌍 AI Translation Integration

* Integration with a locally hosted LibreTranslate service
* Docker-based deployment
* Features:

  * Automatic language detection
  * Real-time translation of messages
  * Multi-language support

---

### 🧩 Modular API Design

* Organized into domain-based endpoints:

  * Authentication
  * User management
  * Translation
  * Messaging (extensible)

---

## 🏗️ Tech Stack

* Framework: Next.js (API Routes)
* Language: TypeScript
* Authentication: Firebase Admin SDK
* Database: Firestore
* AI Service: LibreTranslate (Docker)
* API Style: REST

---

## 📂 Project Structure

educomm-backend/
│
├── pages/api/
│   ├── auth/
│   │   └── auth.ts
│   ├── user/
│   │   └── update-profile.ts
│   ├── translate/
│   │   └── translate.ts
│
├── lib/
│   ├── firebaseAdmin.ts
│   ├── validators.ts
│
├── utils/
│   ├── authMiddleware.ts
│   ├── roleCheck.ts
│
├── types/
│   ├── user.ts
│   ├── api.ts
│
└── README.md

---

## ⚙️ Setup & Installation

### 1. Clone Repository

git clone [https://github.com/your-username/educomm-backend.git](https://github.com/your-username/educomm-backend.git)
cd educomm-backend

---

### 2. Install Dependencies

npm install

---

### 3. Environment Variables

Create a `.env.local` file:

FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key

LIBRETRANSLATE_URL=[http://localhost:5000](http://localhost:5000)

---

### 4. Run Development Server

npm run dev

API will be available at:
[http://localhost:3000/api](http://localhost:3000/api)

---

## 🐳 Running Translation Service (Docker)

docker run -ti --rm -p 5000:5000 libretranslate/libretranslate

---

## 🔐 Authentication Flow

1. Client sends request with token:
   Authorization: Bearer <JWT>

2. Backend:

* Verifies token using Firebase Admin SDK
* Decodes user identity
* Grants or denies access

---

## 🔄 API Endpoints

### Auth

POST /api/auth

---

### User

POST /api/user/update-profile

Body:
{
"name": "New Name",
"username": "newusername"
}

---

### Translation

POST /api/translate

Body:
{
"text": "Hello",
"targetLang": "ar"
}

---

## 🛡️ Security

* JWT-based authentication
* Backend-enforced access control
* Input validation on all endpoints
* Environment variables for sensitive data

---

## ⚡ Performance

* Stateless API design
* Efficient Firestore queries
* Externalized translation processing
* Designed for scalability

---

## 🧪 Testing

* Black-box testing for API endpoints
* Performance testing via Lighthouse (frontend integration)

---

## 🔮 Future Improvements

* WebSocket-based real-time messaging
* Redis caching layer
* Queue system for async processing
* Rate limiting
* Multi-tenant support

---

## 🎯 Design Principles

* Separation of concerns
* Modular architecture
* Security-first approach
* Scalability-ready design

---

## 👨‍💻 Author

Seifeldin Mahmoud
GitHub: [https://github.com/Seifeldin02](https://github.com/Seifeldin02)
LinkedIn: [https://linkedin.com/in/seifeldin02](https://linkedin.com/in/seifeldin02)

---

## 📌 Final Note

This backend is designed as a scalable foundation for modern communication platforms, combining authentication, modular APIs, and AI-powered services into a cohesive system.

---
