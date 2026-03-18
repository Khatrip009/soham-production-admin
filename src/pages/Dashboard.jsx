import { useEffect, useState, useCallback } from "react";
import { supabase } from "../api/supabaseClient";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./Dashboard.css";

// Colors for pie chart
const STATUS_COLORS = {
  new: "#3498db",
  contacted: "#f39c12",
  qualified: "#2ecc71",
  negotiation: "#9b59b6",
  won: "#27ae60",
  lost: "#e74c3c",
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activity, setActivity] = useState([]);
  const [leadsSummary, setLeadsSummary] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch stats (dashboard_stats materialized view)
      const { data: statsData, error: statsError } = await supabase
        .from("dashboard_stats")
        .select("*")
        .single();
      if (statsError) throw statsError;
      setStats(statsData);

      // Fetch orders per day
      const { data: ordersData, error: ordersError } = await supabase
        .from("dashboard_orders_per_day")
        .select("*")
        .limit(10);
      if (ordersError) throw ordersError;
      setOrders(ordersData?.reverse() || []);

      // Fetch user activity
      const { data: activityData, error: activityError } = await supabase
        .from("dashboard_user_activity")
        .select("*")
        .limit(10);
      if (activityError) throw activityError;
      setActivity(activityData?.reverse() || []);

      // Fetch leads summary by status
      const { data: leadsData, error: leadsError } = await supabase
        .from("dashboard_leads_summary")
        .select("*");
      if (leadsError) throw leadsError;
      setLeadsSummary(leadsData || []);

      // Fetch low stock products
      const { data: lowStockData, error: lowStockError } = await supabase
        .from("dashboard_low_stock")
        .select("*");
      if (lowStockError) throw lowStockError;
      setLowStock(lowStockData || []);

      // Fetch top products by sales
      const { data: topProductsData, error: topProductsError } = await supabase
        .from("dashboard_top_products")
        .select("*")
        .limit(5);
      if (topProductsError) throw topProductsError;
      setTopProducts(topProductsData || []);

      // Fetch total revenue
      const { data: revenueData, error: revenueError } = await supabase
        .from("dashboard_total_revenue")
        .select("total_revenue")
        .single();
      if (revenueError) throw revenueError;
      setRevenue(revenueData?.total_revenue || 0);
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError("Failed to load dashboard data. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="dashboard loading">
        <div className="stats-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="premium-card stat-card skeleton" />
          ))}
        </div>
        <div className="charts-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="premium-card skeleton-chart" />
          ))}
        </div>
        <div className="premium-card skeleton-table" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard error">
        <p className="error-message">{error}</p>
        <button onClick={loadDashboard} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Stats Cards - using auto-fit grid */}
      <div className="stats-grid">
        <StatCard title="Products" value={stats?.total_products} />
        <StatCard title="Categories" value={stats?.total_categories} />
        <StatCard title="Users" value={stats?.total_users} />
        <StatCard title="Leads" value={stats?.total_leads} />
        <StatCard title="Comments" value={stats?.total_comments} />
        <StatCard title="Total Likes" value={stats?.total_product_likes} />
        <StatCard title="Revenue" value={`$${revenue?.toLocaleString()}`} />
      </div>

      {/* First row: Orders & Activity */}
      <div className="charts-row">
        <div className="premium-card">
          <h3 className="chart-title">Orders Per Day</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={orders} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="order_date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(20, 20, 30, 0.9)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#c89f72", fontWeight: 600 }}
              />
              <Line
                type="monotone"
                dataKey="total_orders"
                stroke="#c89f72"
                strokeWidth={3}
                dot={{ fill: "#c89f72", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="premium-card">
          <h3 className="chart-title">User Activity</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={activity} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="activity_date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(20, 20, 30, 0.9)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#c89f72", fontWeight: 600 }}
              />
              <Bar
                dataKey="total_actions"
                fill="#c89f72"
                radius={[6, 6, 0, 0]}
                barSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Second row: Leads by Status & Top Products */}
      <div className="charts-row">
        <div className="premium-card">
          <h3 className="chart-title">Leads by Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={leadsSummary}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="total"
                nameKey="status"
              >
                {leadsSummary.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={STATUS_COLORS[entry.status] || "#c89f72"}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(20, 20, 30, 0.9)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="premium-card">
          <h3 className="chart-title">Top Products by Sales</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={topProducts}
              layout="vertical"
              margin={{ top: 10, right: 10, left: 50, bottom: 0 }}
            >
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(20, 20, 30, 0.9)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Bar dataKey="total_sold" fill="#c89f72" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Low Stock Alert Table */}
      <div className="premium-card">
        <h3 className="chart-title">Low Stock Products (&lt; 10)</h3>
        {lowStock.length > 0 ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td className={item.stock < 5 ? "critical-stock" : "low-stock"}>
                    {item.stock}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-data">All products have sufficient stock.</p>
        )}
      </div>
    </div>
  );
}

/* Stat Card Subcomponent */
function StatCard({ title, value }) {
  return (
    <div className="premium-card stat-card">
      <p className="stat-title">{title}</p>
      <h2 className="stat-value">{value ?? "—"}</h2>
    </div>
  );
}