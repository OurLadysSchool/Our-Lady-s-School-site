import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

function App(){
  const [email,setEmail]=useState('admin@ourladys.local')
  const [password,setPassword]=useState('admin123')
  const [token,setToken]=useState('')
  const [students,setStudents]=useState([])
  const [msg,setMsg]=useState('')
  const [student,setStudent]=useState({id:'',fullName:'',className:'',gender:''})

  async function login(){
    const r=await fetch(`${API}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})
    const d=await r.json(); if(!r.ok) return setMsg(d.message||'Login failed'); setToken(d.token); setMsg(`Signed in as ${d.user.fullName}`)
  }
  async function loadStudents(){
    const r=await fetch(`${API}/api/students`,{headers:{Authorization:`Bearer ${token}`}})
    const d=await r.json(); if(!r.ok) return setMsg(d.message||'Load failed'); setStudents(d)
  }
  async function saveStudent(){
    const r=await fetch(`${API}/api/students`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(student)})
    const d=await r.json(); if(!r.ok) return setMsg(d.message||'Save failed'); setStudents([d,...students]); setMsg('Student saved'); setStudent({id:'',fullName:'',className:'',gender:''})
  }
  return <div className="wrap">
    <div className="card"><h1>Our Lady's Catholic Secondary School, Kulende, Ilorin</h1><p>Motto: God is good</p><p>{msg}</p></div>
    <div className="grid grid2">
      <div className="card"><h2>Login</h2><div className="grid"><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/><button onClick={login}>Sign in</button><button onClick={loadStudents}>Load students</button></div></div>
      <div className="card"><h2>Add Student</h2><div className="grid"><input value={student.id} onChange={e=>setStudent({...student,id:e.target.value})} placeholder="Student ID"/><input value={student.fullName} onChange={e=>setStudent({...student,fullName:e.target.value})} placeholder="Full name"/><input value={student.className} onChange={e=>setStudent({...student,className:e.target.value})} placeholder="Class"/><input value={student.gender} onChange={e=>setStudent({...student,gender:e.target.value})} placeholder="Gender"/><button onClick={saveStudent}>Save student</button></div></div>
    </div>
    <div className="card"><h2>Students</h2>{students.map(s=><div key={s.id} style={{padding:'10px 0',borderBottom:'1px solid #e2e8f0'}}>{s.fullName} — {s.id} — {s.className}</div>)}</div>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
