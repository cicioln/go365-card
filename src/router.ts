import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import { useAuthStore } from './stores/auth'
import { useAdminStore } from './stores/admin'
import { setAdminUnauthorizedHandler } from './http'

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', component: Home },
    { path: '/products', component: () => import('./views/Products.vue') },
    { path: '/products/:slug', component: () => import('./views/ProductDetail.vue') },
    { path: '/cart', component: () => import('./views/Cart.vue') },
    { path: '/checkout', redirect: '/cart' },
    { path: '/orders/:no', component: () => import('./views/OrderDetail.vue') },
    { path: '/guest/orders', component: () => import('./views/GuestOrders.vue') },
    { path: '/auth/login', component: () => import('./views/Auth.vue'), props: { mode: 'login' } },
    { path: '/auth/register', component: () => import('./views/Auth.vue'), props: { mode: 'register' } },
    { path: '/me', component: () => import('./views/Me.vue'), meta: { auth: true } },
    { path: '/blog', redirect: '/notice' },
    { path: '/notice', component: () => import('./views/Posts.vue'), props: { type: 'notice' } },
    { path: '/posts/:slug', component: () => import('./views/PostDetail.vue') },
    { path: '/about', component: () => import('./views/Static.vue'), props: { page: 'about' } },
    { path: '/privacy', component: () => import('./views/Static.vue'), props: { page: 'privacy' } },
    { path: '/terms', component: () => import('./views/Static.vue'), props: { page: 'terms' } },
    { path: '/admin/login', component: () => import('./views/admin/AdminLogin.vue'), meta: { layout: 'blank' } },
    {
      path: '/admin',
      component: () => import('./views/admin/AdminLayout.vue'),
      meta: { admin: true, layout: 'blank' },
      children: [
        { path: '', component: () => import('./views/admin/Dashboard.vue'), meta: { title: '仪表盘' } },
        { path: 'products', component: () => import('./views/admin/ProductsAdmin.vue'), meta: { title: '商品管理' } },
        { path: 'products/:id', component: () => import('./views/admin/ProductEdit.vue'), meta: { title: '编辑商品' } },
        { path: 'categories', component: () => import('./views/admin/CategoriesAdmin.vue'), meta: { title: '分类管理' } },
        { path: 'orders', component: () => import('./views/admin/OrdersAdmin.vue'), meta: { title: '订单管理' } },
        { path: 'posts', component: () => import('./views/admin/PostsAdmin.vue'), meta: { title: '文章管理' } },
        { path: 'payments', component: () => import('./views/admin/PaymentsAdmin.vue'), meta: { title: '支付渠道' } },
        { path: 'users', component: () => import('./views/admin/UsersAdmin.vue'), meta: { title: '用户管理' } },
        { path: 'icons', component: () => import('./views/admin/IconsAdmin.vue'), meta: { title: '图标库' } },
        { path: 'logs', component: () => import('./views/admin/LogsAdmin.vue'), meta: { title: '访问日志' } },
        { path: 'settings', component: () => import('./views/admin/SettingsAdmin.vue'), meta: { title: '系统设置' } },
      ],
    },
    { path: '/:pathMatch(.*)*', component: () => import('./views/Static.vue'), props: { page: '404' } },
  ],
})

// 前端守卫只负责页面跳转体验，真正的权限校验在服务端每个接口上
router.beforeEach(async (to) => {
  if (to.matched.some((r) => r.meta.admin)) {
    const admin = useAdminStore()
    await admin.check()
    if (!admin.username) return { path: '/admin/login', query: { redirect: to.fullPath } }
  }
  if (to.meta.auth) {
    const auth = useAuthStore()
    await auth.init()
    if (!auth.user) return { path: '/auth/login', query: { redirect: to.fullPath } }
  }
})

// 后台会话过期时，任意接口返回 401 都跳回登录页
setAdminUnauthorizedHandler(() => {
  useAdminStore().expire()
  const cur = router.currentRoute.value
  if (cur.path.startsWith('/admin') && cur.path !== '/admin/login')
    router.replace({ path: '/admin/login', query: { redirect: cur.fullPath } })
})
