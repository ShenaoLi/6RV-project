<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import * as echarts from "echarts";
import { ElMessage } from "element-plus";
import request from "../utils/request";

const ipv6Input = ref("");
const selectedLocation = ref("beijing");
const selectedProtocol = ref("app_tcpip");
const confidenceThreshold = ref(0.7);
const enableFeedback = ref(true);

// 仪表盘数据（顶部两数 + 趋势图 + 饼图）
const dashboard = ref(null);

// 识别任务状态
const taskId = ref("");
const taskStatus = ref(""); // pending | processing | completed
const taskProgress = ref(0);
let pollTimer = null;

const locations = [
  { label: "北京", value: "beijing" },
  { label: "洛杉矶", value: "los_angeles" },
  { label: "巴黎", value: "paris" },
];


const protocols = [
  { label: "应用层和TCP/IP层", value: "app_tcpip" },
  { label: "仅应用层", value: "app_only" },
  { label: "仅网络层", value: "tcpip_only" },
];

// 根据 value 取地点中文名（表格「探测来源」用）
const getLocationLabel = (value) => locations.find((l) => l.value === value)?.label || value || "--";

// 右侧统计数据（任务完成后由 result_stats 填充，默认 --）
const stats = ref([
  { label: "输入地址数量", value: "--", icon: "icon-icon_IP" },
  { label: "可识别数量", value: "--", icon: "icon-wangzhanIPchaxunicon" },
  { label: "识别占比", value: "--", icon: "icon-zhanbi" },
]);

// 表格数据（任务完成后由 result_details 填充）
const tableData = ref([]);

onMounted(async () => {
  try {
    const data = await request.get("/system/dashboard");
    dashboard.value = data;
    initTrendChart(data.history_12m || []);
    initPieChart(data.vendor_distribution || []);
  } catch (e) {
    console.error("仪表盘请求失败", e);
    initTrendChart([]);
    initPieChart([]);
  }
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});

// 提交识别任务
const submitTask = async () => {
  const raw = (ipv6Input.value || "").trim().split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const addresses = raw.filter((s) => /^([0-9a-fA-F.:]+|\d+\.\d+\.\d+\.\d+)$/.test(s));
  if (addresses.length === 0) {
    ElMessage.warning("请输入至少一个有效的 IPv4 或 IPv6 地址，每行一个");
    return;
  }
  try {
    const res = await request.post("/tasks/identify", {
      addresses,
      location: selectedLocation.value || "beijing",
      method: selectedProtocol.value || "app_tcpip",
      threshold: Number(confidenceThreshold.value),
      enable_incremental: Boolean(enableFeedback.value),
    });
    taskId.value = res.taskId || "";
    taskStatus.value = res.status || "pending";
    taskProgress.value = 0;
    if (res.taskId) {
      ElMessage.success(`任务已提交：${res.taskId}，预计 ${res.est_seconds || 0} 秒`);
      startPolling();
    } else {
      ElMessage.warning("未返回 taskId");
    }
  } catch (e) {
    console.error("提交任务失败", e);
    ElMessage.error(e.response?.data?.message || e.message || "提交任务失败");
  }
};

// 轮询任务状态（每 2 秒）
const startPolling = () => {
  if (pollTimer) clearInterval(pollTimer);
  const doPoll = async () => {
    if (!taskId.value) return;
    try {
      const res = await request.get(`/tasks/${taskId.value}/status`);
      taskStatus.value = res.status || "";
      taskProgress.value = res.progress != null ? res.progress : taskProgress.value;
      if (res.status === "completed") {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
        const details = res.result_details || [];
        const locationLabel = getLocationLabel(selectedLocation.value);
        tableData.value = details.map((d) => ({
          ipv6: d.ip ?? "",
          location: locationLabel,
          method: d.method ?? "--",
          vendor: d.vendor ?? "--",
          score: d.conf !== undefined && d.conf !== null ? String(d.conf) : "--",
        }));
        const rs = res.result_stats;
        if (rs) {
          stats.value[0].value = rs.total_ips !== undefined && rs.total_ips !== null ? String(rs.total_ips) : "--";
          stats.value[1].value = rs.identified_count !== undefined && rs.identified_count !== null ? String(rs.identified_count) : "--";
          stats.value[2].value = rs.identification_rate !== undefined && rs.identification_rate !== null ? `${rs.identification_rate}%` : "--";
        }
        ElMessage.success("识别任务已完成");
        return;
      }
    } catch (e) {
      console.error("轮询任务状态失败", e);
    }
  };
  doPoll();
  pollTimer = setInterval(doPoll, 2000);
};

// 将 "2025-03" 转为 "3月"（坐标轴用）
const formatMonth = (monthStr) => {
  if (!monthStr || !monthStr.includes("-")) return monthStr;
  const m = monthStr.split("-")[1];
  return m ? `${parseInt(m, 10)}月` : monthStr;
};

// 将 "2025-03" 转为 "2025年3月"（tooltip 用）
const formatMonthWithYear = (monthStr) => {
  if (!monthStr || !monthStr.includes("-")) return monthStr;
  const [y, m] = monthStr.split("-");
  return y && m ? `${y}年${parseInt(m, 10)}月` : monthStr;
};

const initTrendChart = (history12m) => {
  const chartDom = document.getElementById("trendChart");
  if (!chartDom) return;
  const myChart = echarts.init(chartDom);
  const xData = history12m.map((item) => formatMonth(item.month));
  const idRateData = history12m.map((item) => item.id_rate);
  const accRateData = history12m.map((item) => item.acc_rate);
  const option = {
    legend: {
      data: ["识别率", "准确率"],
      bottom: 0,
      textStyle: { fontSize: 12, color: "#666" },
    },
    tooltip: {
      trigger: "axis",
      show: true,
      formatter: (params) => {
        const idx = params[0].dataIndex;
        const item = history12m[idx];
        const title = item ? formatMonthWithYear(item.month) : params[0].name;
        const idVal = params[0]?.value ?? "";
        const accVal = params[1]?.value ?? "";
        return `${title}<br/>识别率: ${idVal}%<br/>准确率: ${accVal}%`;
      },
      backgroundColor: "#fff",
      borderColor: "transparent",
      textStyle: { color: "#333", fontSize: 12 },
      padding: [8, 12],
      borderRadius: 4,
      shadowBlur: 4,
      shadowColor: "rgba(0,0,0,0.1)",
    },
    grid: { top: 40, right: 40, bottom: 50, left: 50 },
    xAxis: {
      type: "category",
      data: xData.length ? xData : ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
      axisLine: { lineStyle: { color: "#E5E5E5" } },
      axisLabel: { color: "#999", fontSize: 12 },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#999", fontSize: 12 },
      splitLine: { lineStyle: { color: "#F0F0F0", type: "solid" } },
    },
    series: [
      {
        name: "识别率",
        data: idRateData.length ? idRateData : [],
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        itemStyle: { color: "#FF8A3D", borderColor: "#FF8A3D", borderWidth: 2 },
        lineStyle: { color: "#FF8A3D", width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(255, 138, 61, 0.25)" },
            { offset: 1, color: "rgba(255, 138, 61, 0.03)" },
          ]),
        },
      },
      {
        name: "准确率",
        data: accRateData.length ? accRateData : [],
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        itemStyle: { color: "#39b375", borderColor: "#39b375", borderWidth: 2 },
        lineStyle: { color: "#39b375", width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(57, 179, 117, 0.25)" },
            { offset: 1, color: "rgba(57, 179, 117, 0.03)" },
          ]),
        },
      },
    ],
  };
  myChart.setOption(option);
};

const PIE_COLORS = ["#FF8A3D", "#FFB74D", "#FFD54F", "#FFE082", "#A5D6A7"];

const initPieChart = (vendorDistribution) => {
  const chartDom = document.getElementById("pieChart");
  if (!chartDom) return;
  const myChart = echarts.init(chartDom);
  const total = vendorDistribution.reduce((sum, item) => sum + item.count, 0);
  const data = vendorDistribution.map((item, i) => {
    const pct = total ? ((item.count / total) * 100).toFixed(1) : 0;
    return {
      value: item.count,
      name: `${item.name} (${pct}%)`,
      itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] },
    };
  });
  const option = {
    legend: {
      orient: "vertical",
      right: 20,
      top: "center",
      itemGap: 15,
      textStyle: { fontSize: 12, color: "#666" },
    },
    series: [
      {
        type: "pie",
        radius: ["50%", "70%"],
        center: ["35%", "50%"],
        avoidLabelOverlap: false,
        label: { show: false },
        data: data.length ? data : [],
      },
    ],
  };
  myChart.setOption(option);
};
</script>

<template>
  <div class="page">
    <img src="../assets/images/router_tags.png" class="bg" />
    <div class="top-card">
      <div class="left-section">
        <div class="icon-container">
          <i class="iconfont icon-jichuruanjian"></i>
        </div>
        <div class="info-container">
          <div class="title">6RV系统</div>
          <div class="description">基于增量学习的IPv6路由器厂商识别工具</div>
        </div>
      </div>

      <div class="right-section">
        <div class="stat-item">
          <div class="stat-label">平均识别比例</div>
          <div class="stat-value blue">{{ dashboard?.current_stats?.total_identification_rate != null ? dashboard.current_stats.total_identification_rate + '%' : '--' }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">平均识别准确率</div>
          <div class="stat-value green">{{ dashboard?.current_stats?.total_accuracy_rate != null ? dashboard.current_stats.total_accuracy_rate + '%' : '--' }}</div>
        </div>
      </div>
    </div>

    <div class="main-content">
      <div class="config-panel">
        <div class="panel-header">
          <i class="iconfont icon-renwupeizhi"></i>
          <span>任务配置中心</span>
        </div>

        <div class="panel-body">
          <div class="form-item">
            <div class="label">待探测IPv6地址</div>
            <textarea
              v-model="ipv6Input"
              class="custom-textarea"
              placeholder="在此输入IPv6地址，每行一个"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-item half">
              <div class="label">探测位置</div>
              <el-select
                v-model="selectedLocation"
                placeholder="请选择"
                class="custom-select"
              >
                <el-option
                  v-for="item in locations"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
            <div class="form-item half">
              <div class="label">探测协议</div>
              <el-select
                v-model="selectedProtocol"
                placeholder="请选择"
                class="custom-select"
              >
                <el-option
                  v-for="item in protocols"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
          </div>

          <div class="form-item">
            <div class="label">置信分数阈值 {{ confidenceThreshold }}</div>
            <el-slider
              v-model="confidenceThreshold"
              :min="0"
              :max="1"
              :step="0.1"
              :show-tooltip="false"
              class="custom-slider"
            />
            <div class="slider-marks">
              <span>0</span>
              <span>0.5</span>
              <span>1</span>
            </div>
          </div>

          <div class="feedback-box">
            <div class="feedback-left">
              <i class="iconfont icon-nengliang"></i>
              <span>启用增量学习反馈</span>
            </div>
            <el-switch
              v-model="enableFeedback"
              style="--el-switch-on-color: #2ab267"
            />
          </div>

          <button class="start-btn" @click="submitTask">启动识别任务</button>
        </div>
      </div>

      <div class="result-panel">
        <div class="panel-header">
          <i class="iconfont icon-jieguozhanshi_11"></i>
          <span>结果展示</span>
        </div>
        <div class="panel-body">
          <div class="stats-row">
            <div class="stat-card" v-for="(stat, index) in stats" :key="index">
              <div class="stat-icon-wrapper">
                <i :class="['iconfont', stat.icon]"></i>
              </div>
              <div class="stat-content">
                <div class="stat-label">{{ stat.label }}</div>
                <div class="stat-value">{{ stat.value }}</div>
              </div>
              <img
                src="../assets/images/router_tags_decoration.png"
                class="stat-decoration"
              />
            </div>
          </div>

          <div class="charts-row">
            <div class="chart-container">
              <div class="chart-title">识别率和准确率变化趋势</div>
              <div id="trendChart" style="width: 100%; height: 280px"></div>
            </div>
            <div class="chart-container">
              <div class="chart-title">厂商占比分布</div>
              <div id="pieChart" style="width: 100%; height: 280px"></div>
            </div>
          </div>

          <!-- 数据表格 -->
          <div class="table-container">
            <div class="table-title">识别明细</div>
            <div v-if="taskStatus === 'pending' || taskStatus === 'processing'" class="task-progress-wrap">
              <span class="task-progress-label">任务进度</span>
              <el-progress :percentage="taskProgress" :stroke-width="10" />
            </div>
            <table class="custom-table">
              <thead>
                <tr>
                  <th>IPv6地址</th>
                  <th>探测来源</th>
                  <th>判断方法</th>
                  <th>推测厂商</th>
                  <th>置信分数</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in tableData" :key="index">
                  <td>{{ row.ipv6 }}</td>
                  <td>{{ row.location }}</td>
                  <td>{{ row.method }}</td>
                  <td>{{ row.vendor }}</td>
                  <td class="score">{{ row.score }}</td>
                </tr>
                <tr v-if="tableData.length === 0 && taskStatus !== 'pending' && taskStatus !== 'processing'">
                  <td colspan="5" class="empty-td">暂无数据，请先提交识别任务</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page {
  position: relative;
  .bg {
    position: fixed;
    top: -15px;
    right: 0;
    z-index: 0;
    pointer-events: none;
  }

  .top-card {
    width: 1100px;
    height: 120px;
    background: linear-gradient(90deg, #ffffff, transparent 100%);
    border-radius: 16px;
    display: flex;
    align-items: center;
    padding: 0 40px;
    box-sizing: border-box;
    margin-bottom: 20px;
    gap: 96px;
    .left-section {
      display: flex;
      align-items: center;

      .icon-container {
        width: 42px;
        height: 42px;
        background: rgba(27, 76, 224, 0.05);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 11px;

        .iconfont {
          font-size: 18px;
          color: #1b4ce0;
        }
      }

      .info-container {
        display: flex;
        flex-direction: column;
        justify-content: center;

        .title {
          font-family: "Alimama-ShuHeiTi", sans-serif;
          font-weight: bold;
          font-size: 18px;
          color: #000000;
          line-height: 1;
          margin-bottom: 13px;
        }

        .description {
          font-family: "Microsoft YaHei", sans-serif;
          font-weight: 400;
          font-size: 14px;
          color: #000000;
          opacity: 0.5;
          line-height: 1;
        }
      }
    }

    .right-section {
      display: flex;
      gap: 60px;

      .stat-item {
        display: flex;
        flex-direction: column;

        .stat-label {
          font-family: "Microsoft YaHei", sans-serif;
          font-weight: 400;
          font-size: 14px;
          color: #000000;
          opacity: 0.5;
          line-height: 1;
          margin-bottom: 12px;
        }

        .stat-value {
          font-family: "Agency-FB", sans-serif;
          font-weight: 400;
          font-size: 40px;
          line-height: 1;

          &.blue {
            color: #003cff;
          }

          &.green {
            color: #39b375;
          }
        }
      }
    }
  }

  .main-content {
    z-index: 10;
    position: relative;
    display: flex;
    gap: 20px;
    .panel-header {
      display: flex;
      align-items: center;
      margin-bottom: 15px;

      .iconfont {
        font-size: 18px;
        color: #111633;
        margin-right: 8px;
      }

      span {
        font-family: "Alimama-ShuHeiTi", sans-serif;
        font-weight: bold;
        font-size: 18px;
        color: #111633;
        line-height: 1;
      }
    }

    .config-panel {
      width: 560px;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;

      .panel-body {
        flex: 1;
        border-radius: 16px;
        background: #ffffff;
        padding: 25px 20px;
        box-sizing: border-box;
        box-shadow: 0px 2px 4px 0px rgba(0, 5, 97, 0.08);
      }

      .form-item {
        margin-bottom: 15px;

        .label {
          font-family: "Microsoft YaHei", sans-serif;
          font-weight: bold;
          font-size: 14px;
          color: #000000;
          line-height: 1;
          margin-bottom: 15px;
        }

        .custom-textarea {
          width: 520px;
          height: 200px;
          background: #ffffff;
          border-radius: 4px;
          border: 1px solid #d8dade;
          padding: 10px;
          box-sizing: border-box;
          font-family: "Microsoft YaHei", sans-serif;
          font-size: 14px;
          resize: none;
          outline: none;

          &::placeholder {
            font-size: 12px;
            color: #000000;
            opacity: 0.5;
          }
        }
      }

      .form-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 20px;

        .half {
          width: 250px;
        }

        .custom-select {
          width: 100%;
          :deep(.el-input__wrapper) {
            height: 36px;
            border-radius: 4px;
            border: 1px solid #d8dade;
            box-shadow: none !important;
            &.is-focus {
              border-color: #1b4ce0;
            }
          }
        }
      }

      .slider-marks {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #909399;
        margin-top: -5px;
      }

      :deep(.el-slider__bar) {
        background-color: #1b4ce0;
      }
      :deep(.el-slider__button) {
        border-color: #1b4ce0;
      }

      .feedback-box {
        width: 100%;
        height: 46px;
        background: rgba(42, 178, 103, 0.05);
        border-radius: 4px;
        border: 1px solid #2ab267;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 15px;
        margin-bottom: 40px;

        .feedback-left {
          display: flex;
          align-items: center;

          .iconfont {
            color: #2ab267;
            margin-right: 19px;
            font-size: 16px;
          }

          span {
            font-family: "Microsoft YaHei", sans-serif;
            font-weight: bold;
            font-size: 14px;
            color: #2ab267;
          }
        }
      }

      .start-btn {
        width: 200px;
        height: 36px;
        background: #1b4ce0;
        border-radius: 18px;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: "Microsoft YaHei", sans-serif;
        font-weight: 400;
        font-size: 14px;
        color: #ffffff;
        transition: opacity 0.2s;

        &:hover {
          opacity: 0.9;
        }
      }
    }

    .result-panel {
      flex: 1;

      .panel-body {
        background: #ffffff;
        border-radius: 16px;
        padding: 25px 20px;
        box-sizing: border-box;
        box-shadow: 0px 2px 4px 0px rgba(0, 5, 97, 0.08);

        .stats-row {
          display: flex;
          gap: 20px;
          margin-bottom: 31px;

          .stat-card {
            flex: 1;
            height: 140px;
            padding: 20px;
            box-sizing: border-box;
            position: relative;
            display: flex;
            align-items: flex-start;
            gap: 15px;
            box-shadow: 0px 2px 4px 0px rgba(0, 5, 97, 0.08);
            border-radius: 16px;
            .stat-icon-wrapper {
              width: 42px;
              height: 42px;
              background: rgba(27, 76, 224, 0.05);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;

              .iconfont {
                font-size: 18px;
                color: #1b4ce0;
              }
            }

            .stat-content {
              flex: 1;

              .stat-label {
                font-family: "Microsoft YaHei", sans-serif;
                font-weight: 400;
                font-size: 16px;
                color: #000000;
                opacity: 0.5;
                line-height: 1;
                margin-bottom: 20px;
              }

              .stat-value {
                font-family: "Agency-FB", sans-serif;
                font-weight: 400;
                font-size: 40px;
                color: #000000;
                line-height: 1;
              }
            }

            .stat-decoration {
              position: absolute;
              right: 20px;
              bottom: 20px;
              width: 144px;
              height: 49px;
            }
          }
        }

        .charts-row {
          display: flex;
          gap: 20px;
          margin-bottom: 25px;

          .chart-container {
            flex: 1;
            box-sizing: border-box;

            .chart-title {
              font-family: "Microsoft YaHei", sans-serif;
              font-weight: bold;
              font-size: 14px;
              color: #000000;
            }
          }
        }

        .table-container {
          box-sizing: border-box;

          .table-title {
            font-family: "Microsoft YaHei", sans-serif;
            font-weight: bold;
            font-size: 14px;
            color: #000000;
            margin-bottom: 21px;
          }

          .task-progress-wrap {
            margin-bottom: 16px;
            .task-progress-label {
              display: block;
              font-size: 12px;
              color: #666;
              margin-bottom: 8px;
            }
          }

          .custom-table {
            width: 100%;
            border-collapse: collapse;

            thead {
              tr {
                height: 40px;
                background: #f3f7fa;

                th {
                  font-family: "Microsoft YaHei", sans-serif;
                  font-weight: 400;
                  font-size: 12px;
                  color: #848790;
                  text-align: left;
                  padding: 0 15px;

                  &:first-child {
                    border-radius: 4px 0 0 4px;
                  }

                  &:last-child {
                    border-radius: 0 4px 4px 0;
                  }
                }
              }
            }

            tbody {
              tr {
                height: 44px;

                &:nth-child(even) {
                  background: #fafafa;
                }

                td {
                  font-family: "Microsoft YaHei", sans-serif;
                  font-weight: 400;
                  font-size: 12px;
                  color: #293038;
                  padding: 0 15px;

                  &.score {
                    color: #2ab267;
                    font-weight: bold;
                  }

                  &.empty-td {
                    text-align: center;
                    color: #999;
                    padding: 24px;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
</style>
