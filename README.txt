DEPLOY NOW GUIDE

What I prepared:
- Backend ready for Railway or Render
- Frontend ready for Vercel
- PostgreSQL-ready backend
- Environment variable examples included

Recommended deployment order:
1) Create a PostgreSQL database on Railway, Render, Neon, or Supabase.
2) Deploy /backend and set:
   DATABASE_URL=
   JWT_SECRET=
   FRONTEND_URL=
   PGSSL=true
3) After backend is live, copy its public URL.
4) Deploy /frontend and set:
   VITE_API_BASE_URL=https://your-backend-url
5) Update backend FRONTEND_URL to your frontend live URL.

Demo login:
admin@ourladys.local / admin123

Note:
I cannot deploy these services or attach a domain from inside this chat, but this package is structured for immediate upload.
