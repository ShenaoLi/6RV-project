import axios from 'axios'

// 创建 axios 实例
const request = axios.create({
  baseURL: 'https://c8d28c9edf94bcee-219-243-212-106.serveousercontent.com/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    const res = response.data
    return res
  },
  (error) => {
    const message = error.response?.data?.message ?? error.message ?? '请求失败'
    console.error('[request error]', message)
    return Promise.reject(error)
  }
)

export default request
