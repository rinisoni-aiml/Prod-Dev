export const unwrapData = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload?.data ?? [];
};

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const formatNumber = (value) => {
  return new Intl.NumberFormat("en-IN").format(toNumber(value));
};

export const formatPercent = (value, digits = 1) => {
  return `${toNumber(value).toFixed(digits)}%`;
};

export const formatCurrency = (value) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
};

export const formatCompactCurrency = (value) => {
  const amount = toNumber(value);

  if (Math.abs(amount) >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  }

  if (Math.abs(amount) >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }

  return formatCurrency(amount);
};

export const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const daysUntil = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = date.getTime() - today.getTime();

  return Math.round(diff / 86400000);
};

export const getRiskColor = (score) => {
  const value = toNumber(score);

  if (value >= 75) {
    return "#EF4444";
  }

  if (value >= 50) {
    return "#F97316";
  }

  if (value >= 35) {
    return "#F59E0B";
  }

  return "#10B981";
};

export const getRiskLabel = (score) => {
  const value = toNumber(score);

  if (value >= 75) {
    return "Critical";
  }

  if (value >= 50) {
    return "High";
  }

  if (value >= 35) {
    return "Medium";
  }

  return "Low";
};

export const getRiskBadgeLevel = (score) => {
  const value = toNumber(score);

  if (value >= 75) {
    return "critical";
  }

  if (value >= 50) {
    return "high";
  }

  if (value >= 35) {
    return "medium";
  }

  return "low";
};

export const getExpiryState = (days) => {
  if (days == null) {
    return { label: "Not available", level: "info" };
  }

  if (days < 0) {
    return { label: `Expired ${Math.abs(days)} days ago`, level: "critical" };
  }

  if (days === 0) {
    return { label: "Expires today", level: "critical" };
  }

  if (days <= 7) {
    return { label: `Expires in ${days} days`, level: "critical" };
  }

  if (days <= 30) {
    return { label: `Expires in ${days} days`, level: "high" };
  }

  if (days <= 60) {
    return { label: `Expires in ${days} days`, level: "medium" };
  }

  return { label: `Expires in ${days} days`, level: "low" };
};

export const getStatusColor = (status) => {
  const normalized = String(status || "").toUpperCase();

  if (normalized.includes("DELAY")) {
    return "#EF4444";
  }

  if (normalized.includes("DELIVER")) {
    return "#10B981";
  }

  if (normalized.includes("TRANSIT") || normalized.includes("DISPATCH")) {
    return "#3B82F6";
  }

  if (normalized.includes("MAINTENANCE")) {
    return "#F97316";
  }

  return "#94A3B8";
};
