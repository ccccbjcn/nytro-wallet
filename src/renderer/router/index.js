import Vue from 'vue'
import Router from 'vue-router'
import Dashboard from '../components/Dashboard.vue'
import Add from '../components/Add.vue'
import Account from '../components/Account.vue'
import Transfer from '../components/Transfer.vue'

Vue.use(Router);

export default new Router({
  routes: [
    {
      path: '/',
      name: 'Dashboard',
      component: Dashboard
    },
    {
      path: '/add',
      name: 'add',
      component: Add
    },
    {
      path: '/account/:address',
      name: 'Account',
      component: Account,
      props: true
    },
    {
      path: '/transfer/:address',
      name: 'Transfer',
      component: Transfer,
      props: true
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
})
