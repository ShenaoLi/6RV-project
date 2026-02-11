import { createRouter, createWebHistory } from 'vue-router'
import Layout from '../layout/index.vue'

const routes = [
  {
    path: '/',
    component: Layout,
    redirect: '/router-tags',
    children: [
      {
        path: 'ipv6-detection',
        name: 'Ipv6Detection',
        component: () => import('../views/Ipv6Detection.vue'),
        meta: { title: 'IPv6探测工具' }
      },
      {
        path: 'topology-detection',
        name: 'TopologyDetection',
        component: () => import('../views/TopologyDetection.vue'),
        meta: { title: '拓扑探测工具' }
      },
      {
        path: 'router-tags',
        name: 'RouterTags',
        component: () => import('../views/RouterTags.vue'),
        meta: { title: '路由器厂商标签挖掘' }
      },
      {
        path: 'organization-tags',
        name: 'OrganizationTags',
        component: () => import('../views/OrganizationTags.vue'),
        meta: { title: '组织行业标签挖掘' }
      },
      {
        path: 'knowledge-graph',
        name: 'KnowledgeGraph',
        component: () => import('../views/KnowledgeGraph.vue'),
        meta: { title: '对抗环境认知图谱' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
