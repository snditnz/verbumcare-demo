# VerbumCare Product Overview

VerbumCare is an AI-powered healthcare documentation and care management platform designed for Japanese healthcare facilities, multi-site organizations, and geriatric care providers.

## Core Value Proposition

- **Offline AI Processing**: Complete voice-to-structured-data pipeline operates without internet connectivity (20-30 seconds processing time)
- **Voice-First Documentation**: Natural language clinical notes reduce documentation time by 60-70%
- **Multi-Language Support**: Native Japanese, English, and Traditional Chinese throughout the entire platform
- **Zero-Error Medication Safety**: Two-point barcode verification with cryptographic hash chain for immutability
- **Mobile-First Design**: iPad-native application for bedside and mobile care delivery

## System Components

1. **Backend API**: Node.js/Express with PostgreSQL - handles all business logic, AI orchestration, and data persistence
2. **iPad App**: React Native/Expo - primary clinical interface for nurses and care staff
3. **Admin Portal**: React web application - facility management and reporting
4. **AI Services**: Local Llama 3.1 8B (Ollama) + faster-whisper for offline voice processing

## Target Users

- **Clinical Staff**: Nurses, physicians, care workers, therapists, dietitians
- **Administrators**: Facility managers, care managers, quality assurance staff
- **Multi-Site Organizations**: Hospital groups, nursing home chains, clinic networks

## Key Features

- Patient management with comprehensive demographics and medical history
- Medication administration with barcode scanning and cryptographic audit trail
- Vital signs monitoring with BLE device integration (A&D UA-656BLE blood pressure monitors)
- Voice-powered clinical documentation (SOAP notes, assessments, incident reports)
- Care plan management with problem-oriented approach and monitoring workflows
- Standards-based interoperability (HL7 v2.5, SS-MIX2 for Japanese market)
- Real-time dashboard with metrics, alerts, and activity feeds

## Deployment Model

- **Single-server architecture**: All services run on one machine (pn51-e1)
- **Offline-first**: Complete functionality without internet connectivity
- **LAN deployment**: Uses mDNS (verbumcare-lab.local) with self-signed SSL certificates
- **Docker-based**: PostgreSQL and backend run in containers for easy deployment
