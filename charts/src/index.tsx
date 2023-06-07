import './app.scss'
import React from 'react'
import { createRoot } from 'react-dom/client'
import AppRoutes from './AppRoutes'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const container = document.getElementById('root')

if (container != null) {
  const root = createRoot(container)
  root.render(
    <>
      <AppRoutes/>
      <ToastContainer position='top-left'/>
    </>)
}
