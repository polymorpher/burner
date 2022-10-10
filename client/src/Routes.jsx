import React from 'react'
import { BrowserRouter, Route, Switch, Redirect } from 'react-router-dom'
import Burn from './Burn'
import Debug from './Debug'

const Routes = () => {
  return (
    <BrowserRouter>
      <Switch>
        <Route exact path='/' render={() => <Burn />} />
        <Route path='/burn' render={() => <Burn />} />
        <Route path='/debug' render={() => <Debug />} />
        <Redirect to='/' />
      </Switch>
    </BrowserRouter>
  )
}

export default Routes
