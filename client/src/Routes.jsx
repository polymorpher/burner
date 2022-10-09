import React from 'react'
import { BrowserRouter, Route, Switch, Redirect } from 'react-router-dom'
import Burn from './Burn'

const Routes = () => {
  return (
    <BrowserRouter>
      <Switch>
        <Route exact path='/' render={() => <Burn />} />
        <Route path='/gss' render={() => <Burn />} />
        <Redirect to='/' />
      </Switch>
    </BrowserRouter>
  )
}

export default Routes
