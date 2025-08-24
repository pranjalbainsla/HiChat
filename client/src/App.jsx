import { useState } from 'react'
import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import PrivateRoute from './routes/PrivateRoute'
import Chat from './pages/Chat'
import GoogleRedirectHandler from './pages/GoogleRedirectHandler'

function App() {
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Login />} />
        <Route path='/signup' element={<Signup />}/>
        <Route path='/chat' element={
          <PrivateRoute>
            <Chat />
          </PrivateRoute>
        } />
        <Route path='/auth/google/redirect' element={<GoogleRedirectHandler />}/>
      </Routes>
    </BrowserRouter>
  )
}

export default App
