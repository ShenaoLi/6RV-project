<template>
  <div class="layout-container">
    <aside class="sidebar">
      <div class="logo">
        <p>全球网络空间认知</p>
        <p>原型系统</p>
      </div>
      <nav class="menu">
        <div
          v-for="item in menuList"
          :key="item.path"
          class="menu-item"
          :class="{ active: isActive(item.path) }"
          @click="handleMenuClick(item.path)"
        >
          <div class="inner">
            <div class="icon-wrap">
              <i :class="['iconfont', item.icon]"></i>
            </div>
            <span>{{ item.name }}</span>
          </div>
        </div>
      </nav>
    </aside>

    <div class="main-wrapper">
      <header class="header">
        <div class="header-left">
          <span class="breadcrumb">{{ route.meta.title }}</span>
        </div>
        <div class="header-right">
          <el-dropdown>
            <span class="user-info">
              Admin
              <el-icon class="el-icon--right"><arrow-down /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>个人中心</el-dropdown-item>
                <el-dropdown-item>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <el-scrollbar class="content-scrollbar">
        <main class="content">
          <router-view />
        </main>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ArrowDown } from "@element-plus/icons-vue";

const router = useRouter();
const route = useRoute();

const menuList = ref([
  {
    name: "IPv6探测工具",
    path: "/ipv6-detection",
    icon: "icon-dianziduikangbudui",
  },
  {
    name: "拓扑探测工具",
    path: "/topology-detection",
    icon: "icon-icon-monitor",
  },
  {
    name: "路由器厂商标签挖掘",
    path: "/router-tags",
    icon: "icon-luyouqi",
  },
  {
    name: "组织行业标签挖掘",
    path: "/organization-tags",
    icon: "icon-zuzhijiagou",
  },
  {
    name: "对抗环境认知图谱",
    path: "/knowledge-graph",
    icon: "icon-tuopu",
  },
]);

const isActive = (path) => {
  return route.path === path;
};

const handleMenuClick = (path) => {
  router.push(path);
};
</script>

<style lang="scss" scoped>
.layout-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #111633;

  .sidebar {
    width: 210px;
    display: flex;
    flex-direction: column;
    background: #111633;
    .logo {
      width: 190px;
      height: 72px;
      background: linear-gradient(to right, transparent, #242b59, transparent);
      border-radius: 4px;
      margin: 20px 0 0 15px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      p {
        font-weight: bold;
        font-size: 16px;
        line-height: 24px;
        color: #ffffff;
      }
    }

    .menu {
      box-sizing: border-box;
      flex: 1;
      padding-left: 20px;
      padding-top: 20px;
      overflow-y: auto;
      .menu-item {
        display: flex;
        align-items: center;
        margin: 10px 0;
        position: relative;
        &.active {
          .inner {
            color: #111633;
            background: #f5f5f5;
            border-radius: 100px 0 0 100px;
            .icon-wrap {
              color: #fff;
              background: #111633;
            }
          }

          &::before,
          &::after {
            content: "";
            position: absolute;
            right: 0;
            width: 20px;
            height: 20px;
            background: #111633;
            z-index: 1;
          }

          &::before {
            top: -20px;
            border-bottom-right-radius: 20px;
            box-shadow: 10px 10px 0 10px #f5f5f5;
          }

          &::after {
            bottom: -20px;
            border-top-right-radius: 20px;
            box-shadow: 10px -10px 0 10px #f5f5f5;
          }
        }
        .inner {
          display: flex;
          align-items: center;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          position: relative;
          box-sizing: border-box;
          height: 42px;
          width: 100%;
          padding: 7px;
          .icon-wrap {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 6px;
            i {
              font-size: 16px;
            }
          }
        }
      }
    }
  }

  .main-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #f5f5f5;
    border-radius: 16px 0px 0px 16px;
    .header {
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      z-index: 10;

      .header-left {
        .breadcrumb {
          font-size: 16px;
          color: rgba(4, 7, 26, 0.8);
          font-weight: bold;
        }
      }

      .header-right {
        .user-info {
          display: flex;
          align-items: center;
          cursor: pointer;
          font-size: 16px;
          color: rgba(4, 7, 26, 0.8);
          font-weight: bold;

          &:hover {
            background: #f5f7fa;
          }

          .el-icon {
            margin-left: 4px;
          }
        }
      }
    }
    .content-scrollbar {
      flex: 1;
      .content {
        padding: 0 20px 20px;
      }
    }
  }
}
</style>
