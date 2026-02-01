# Setup Guide for cørtapp

This application is built with React + TypeScript + Vite and uses Supabase for the backend (Database & Authentication).

## Prerequisites

1.  **Node.js**: Ensure you have Node.js installed.
2.  **Supabase Account**: Sign up for a free account at [supabase.com](https://supabase.com).

## Setup Steps

### 1. Create a Supabase Project

1.  Log in to Supabase and create a new project.
2.  Note down your `Project URL` and `anon public key` from the project settings.

### 2. Configure Environment Variables

1.  Copy `.env.example` to `.env`:
    ```bash
    cp .env.example .env
    ```
2.  Edit `.env` and paste your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_project_url
    VITE_SUPABASE_ANON_KEY=your_anon_key
    ```

### 3. Initialize the Database

1.  Go to the **SQL Editor** in your Supabase dashboard.
2.  Copy the contents of `supabase_schema.sql` (found in the root of this project).
3.  Paste it into the SQL Editor and click **Run**.
    *   This will create all necessary tables (players, matches, seasons, profiles, etc.) and security policies.

### 4. Configure Authentication

1.  Go to **Authentication > Providers** in Supabase.
2.  Enable **Email** provider.
3.  (Optional) Disable "Confirm email" if you want users to log in immediately without verifying email (useful for testing).

### 5. Run the Application

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Start the development server:
    ```bash
    npm run dev
    ```

## Admin Access

By default, new users are "viewers". To make yourself an admin:
1.  Sign up / Log in to the app (using Password or Magic Link).
2.  Go to your Supabase **Table Editor > profiles**.
3.  Find your user row and change the `role` column from `viewer` to `admin`.
4.  Refresh the app. You should now see admin controls (Players, Users, Seasons management).

## Features

*   **League Table**: Live standings based on points (2 for win, 1 for draw, etc.).
*   **Match Entry**: Enter scores for completed matches.
*   **Fixtures**: Generate fair doubles pairings using a round-robin style scheduler.
*   **Seasons**: Archive past seasons and start fresh.
*   **User Management**: Invite users via email (Magic Link) and manage roles.
*   **Chat**: Per-match chat threads for coordination.
