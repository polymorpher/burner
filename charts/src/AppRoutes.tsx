import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './Home'

const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/stats/*' element={ <Home />} />
        <Route path='/*' element={ <Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRoutes
