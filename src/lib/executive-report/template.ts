/**
 * Executive Report Email Template
 * 
 * Generates HTML and plain-text versions of the daily executive report.
 * 
 * @created 2026-06-11
 */

import { BRAND } from "../brand";
import type { ExecutiveReportData } from "./generator";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTML TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

export function generateHtmlEmail(data: ExecutiveReportData): string {
  const { summary, packages, attribution, funnel, topVehicles, topPackages, topTireSizes, alerts } = data;
  
  const hasAlerts = alerts.length > 0;
  const criticalAlerts = alerts.filter(a => a.type === 'critical');
  const warningAlerts = alerts.filter(a => a.type === 'warning');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Executive Report - ${formatDate(data.reportDate)}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      color: white;
      padding: 32px 40px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 700;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 32px 40px;
    }
    .section {
      margin-bottom: 32px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #374151;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    @media (max-width: 600px) {
      .metric-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .metric-card {
      background: #f9fafb;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .metric-card.highlight {
      background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
      border: 1px solid #86efac;
    }
    .metric-card.warning {
      background: #fef3c7;
      border: 1px solid #fcd34d;
    }
    .metric-value {
      font-size: 28px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
    }
    .metric-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-sublabel {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 4px;
    }
    .alert-box {
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .alert-critical {
      background: #fef2f2;
      border: 1px solid #fca5a5;
      color: #991b1b;
    }
    .alert-warning {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      color: #92400e;
    }
    .alert-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
    .alert-value {
      font-size: 12px;
      opacity: 0.8;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
    }
    .table th {
      text-align: left;
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      padding: 8px 12px;
      border-bottom: 2px solid #e5e7eb;
    }
    .table td {
      padding: 12px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 14px;
    }
    .table tr:last-child td {
      border-bottom: none;
    }
    .rank {
      font-weight: 700;
      color: #9ca3af;
      width: 30px;
    }
    .funnel-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .funnel-row:last-child {
      border-bottom: none;
    }
    .funnel-label {
      font-size: 14px;
      color: #374151;
    }
    .funnel-value {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
    }
    .footer {
      background: #f9fafb;
      padding: 24px 40px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    .footer a {
      color: #dc2626;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>📊 Daily Executive Report</h1>
      <p>${BRAND.name} • ${formatDate(data.reportDate)}</p>
    </div>
    
    <div class="content">
      ${hasAlerts ? `
      <!-- Alerts -->
      <div class="section">
        <div class="section-title">⚠️ Alerts & Watch Items</div>
        ${criticalAlerts.map(a => `
          <div class="alert-box alert-critical">
            <div class="alert-title">🚨 ${a.message}</div>
            <div class="alert-value">${a.value}</div>
          </div>
        `).join('')}
        ${warningAlerts.map(a => `
          <div class="alert-box alert-warning">
            <div class="alert-title">⚠️ ${a.message}</div>
            <div class="alert-value">${a.value}</div>
          </div>
        `).join('')}
      </div>
      ` : ''}
      
      <!-- Executive Summary -->
      <div class="section">
        <div class="section-title">💰 Executive Summary</div>
        <div class="metric-grid">
          <div class="metric-card highlight">
            <div class="metric-value">${formatCurrency(summary.revenueYesterday)}</div>
            <div class="metric-label">Revenue Yesterday</div>
            <div class="metric-sublabel">${summary.ordersYesterday} orders</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(summary.aovYesterday)}</div>
            <div class="metric-label">AOV Yesterday</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(summary.revenue7d)}</div>
            <div class="metric-label">Revenue 7 Days</div>
            <div class="metric-sublabel">${summary.orders7d} orders</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(summary.aov7d)}</div>
            <div class="metric-label">AOV 7 Days</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(summary.revenue30d)}</div>
            <div class="metric-label">Revenue 30 Days</div>
            <div class="metric-sublabel">${summary.orders30d} orders</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(summary.aov30d)}</div>
            <div class="metric-label">AOV 30 Days</div>
          </div>
        </div>
      </div>
      
      <!-- Package Performance -->
      <div class="section">
        <div class="section-title">📦 Package Performance (30 Days)</div>
        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-value">${packages.orders}</div>
            <div class="metric-label">Package Orders</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(packages.revenue)}</div>
            <div class="metric-label">Package Revenue</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${packages.percentageOfTotal.toFixed(1)}%</div>
            <div class="metric-label">% of Total Revenue</div>
          </div>
        </div>
        ${packages.topPackage ? `
        <div style="margin-top: 16px; padding: 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
          <div style="font-size: 12px; color: #166534; font-weight: 600; margin-bottom: 4px;">🏆 Top Package</div>
          <div style="font-size: 14px; color: #15803d;">
            ${packages.topPackage.wheel} + ${packages.topPackage.tire}<br>
            <span style="font-size: 12px; color: #22c55e;">${packages.topPackage.orders} orders • ${formatCurrency(packages.topPackage.revenue)}</span>
          </div>
        </div>
        ` : ''}
      </div>
      
      <!-- Attribution -->
      <div class="section">
        <div class="section-title">🎯 Revenue Attribution (30 Days)</div>
        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(attribution.jake.revenue)}</div>
            <div class="metric-label">🤖 Jake Assisted</div>
            <div class="metric-sublabel">${attribution.jake.orders} orders</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(attribution.garage.revenue)}</div>
            <div class="metric-label">🏠 Garage Users</div>
            <div class="metric-sublabel">${attribution.garage.orders} orders</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${formatCurrency(attribution.quickView.revenue)}</div>
            <div class="metric-label">👁️ Quick View</div>
            <div class="metric-sublabel">${attribution.quickView.orders} orders</div>
          </div>
        </div>
      </div>
      
      <!-- Conversion Funnel -->
      <div class="section">
        <div class="section-title">📈 Conversion Funnel (30 Days)</div>
        <div class="funnel-row">
          <span class="funnel-label">🚗 Vehicle Saves</span>
          <span class="funnel-value">${funnel.vehicleSaves.toLocaleString()}</span>
        </div>
        <div class="funnel-row">
          <span class="funnel-label">🔄 Vehicle Restores</span>
          <span class="funnel-value">${funnel.vehicleRestores.toLocaleString()}</span>
        </div>
        <div class="funnel-row">
          <span class="funnel-label">🏠 Garage Users</span>
          <span class="funnel-value">${funnel.garageUsers.toLocaleString()}</span>
        </div>
        <div class="funnel-row">
          <span class="funnel-label">👁️ Quick View Opens</span>
          <span class="funnel-value">${funnel.quickViewOpens.toLocaleString()}</span>
        </div>
        <div class="funnel-row">
          <span class="funnel-label">📦 Package Builder Entries</span>
          <span class="funnel-value">${funnel.packageBuilderEntries.toLocaleString()}</span>
        </div>
        <div class="funnel-row">
          <span class="funnel-label">🛒 Cart Adds</span>
          <span class="funnel-value">${funnel.cartAdds.toLocaleString()}</span>
        </div>
        <div class="funnel-row">
          <span class="funnel-label">💳 Checkout Starts</span>
          <span class="funnel-value">${funnel.checkoutStarts.toLocaleString()}</span>
        </div>
        <div class="funnel-row" style="background: #f0fdf4; margin: 0 -12px; padding: 10px 12px; border-radius: 8px;">
          <span class="funnel-label" style="font-weight: 600;">✅ Orders</span>
          <span class="funnel-value" style="color: #16a34a;">${funnel.orders.toLocaleString()}</span>
        </div>
      </div>
      
      <!-- Top Performers -->
      <div class="section">
        <div class="section-title">🏆 Top Performers (30 Days)</div>
        
        <!-- Top Vehicles -->
        <h4 style="font-size: 14px; color: #374151; margin: 16px 0 8px;">🚗 Top Vehicles</h4>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Vehicle</th>
              <th style="text-align: right;">Orders</th>
              <th style="text-align: right;">Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${topVehicles.length > 0 ? topVehicles.map((v, i) => `
            <tr>
              <td class="rank">${i + 1}</td>
              <td>${v.vehicle}</td>
              <td style="text-align: right;">${v.orders}</td>
              <td style="text-align: right;">${formatCurrency(v.revenue)}</td>
            </tr>
            `).join('') : '<tr><td colspan="4" style="text-align: center; color: #9ca3af;">No data</td></tr>'}
          </tbody>
        </table>
        
        <!-- Top Packages -->
        <h4 style="font-size: 14px; color: #374151; margin: 24px 0 8px;">📦 Top Packages</h4>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Package</th>
              <th style="text-align: right;">Orders</th>
              <th style="text-align: right;">Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${topPackages.length > 0 ? topPackages.map((p, i) => `
            <tr>
              <td class="rank">${i + 1}</td>
              <td>${p.wheel}<br><span style="font-size: 12px; color: #6b7280;">+ ${p.tire}</span></td>
              <td style="text-align: right;">${p.orders}</td>
              <td style="text-align: right;">${formatCurrency(p.revenue)}</td>
            </tr>
            `).join('') : '<tr><td colspan="4" style="text-align: center; color: #9ca3af;">No data</td></tr>'}
          </tbody>
        </table>
        
        <!-- Top Tire Sizes -->
        <h4 style="font-size: 14px; color: #374151; margin: 24px 0 8px;">🛞 Top Tire Sizes</h4>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Size</th>
              <th style="text-align: right;">Orders</th>
              <th style="text-align: right;">Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${topTireSizes.length > 0 ? topTireSizes.map((t, i) => `
            <tr>
              <td class="rank">${i + 1}</td>
              <td>${t.size}</td>
              <td style="text-align: right;">${t.orders}</td>
              <td style="text-align: right;">${formatCurrency(t.revenue)}</td>
            </tr>
            `).join('') : '<tr><td colspan="4" style="text-align: center; color: #9ca3af;">No data</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p>Generated at ${new Date(data.generatedAt).toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })}</p>
      <p><a href="https://shop.warehousetiredirect.com/admin/revenue">View Full Revenue Dashboard →</a></p>
      <p style="margin-top: 8px;">${BRAND.name}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLAIN TEXT TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

export function generatePlainTextEmail(data: ExecutiveReportData): string {
  const { summary, packages, attribution, funnel, topVehicles, topPackages, topTireSizes, alerts } = data;
  
  let text = `
${BRAND.name} - DAILY EXECUTIVE REPORT
${'='.repeat(50)}
${formatDate(data.reportDate)}

`;

  // Alerts
  if (alerts.length > 0) {
    text += `⚠️ ALERTS & WATCH ITEMS
${'-'.repeat(50)}
`;
    for (const alert of alerts) {
      text += `${alert.type === 'critical' ? '🚨' : '⚠️'} ${alert.message}
   ${alert.value}
`;
    }
    text += '\n';
  }

  // Executive Summary
  text += `💰 EXECUTIVE SUMMARY
${'-'.repeat(50)}
Revenue Yesterday:  ${formatCurrency(summary.revenueYesterday)} (${summary.ordersYesterday} orders)
AOV Yesterday:      ${formatCurrency(summary.aovYesterday)}
Revenue 7 Days:     ${formatCurrency(summary.revenue7d)} (${summary.orders7d} orders)
Revenue 30 Days:    ${formatCurrency(summary.revenue30d)} (${summary.orders30d} orders)

`;

  // Package Performance
  text += `📦 PACKAGE PERFORMANCE (30 Days)
${'-'.repeat(50)}
Package Orders:     ${packages.orders}
Package Revenue:    ${formatCurrency(packages.revenue)}
% of Total:         ${packages.percentageOfTotal.toFixed(1)}%
`;
  if (packages.topPackage) {
    text += `Top Package:        ${packages.topPackage.wheel} + ${packages.topPackage.tire}
                    (${packages.topPackage.orders} orders, ${formatCurrency(packages.topPackage.revenue)})
`;
  }
  text += '\n';

  // Attribution
  text += `🎯 REVENUE ATTRIBUTION (30 Days)
${'-'.repeat(50)}
Jake Assisted:      ${formatCurrency(attribution.jake.revenue)} (${attribution.jake.orders} orders)
Garage Users:       ${formatCurrency(attribution.garage.revenue)} (${attribution.garage.orders} orders)
Quick View:         ${formatCurrency(attribution.quickView.revenue)} (${attribution.quickView.orders} orders)

`;

  // Conversion Funnel
  text += `📈 CONVERSION FUNNEL (30 Days)
${'-'.repeat(50)}
Vehicle Saves:      ${funnel.vehicleSaves.toLocaleString()}
Vehicle Restores:   ${funnel.vehicleRestores.toLocaleString()}
Garage Users:       ${funnel.garageUsers.toLocaleString()}
Quick View Opens:   ${funnel.quickViewOpens.toLocaleString()}
Package Builder:    ${funnel.packageBuilderEntries.toLocaleString()}
Cart Adds:          ${funnel.cartAdds.toLocaleString()}
Checkout Starts:    ${funnel.checkoutStarts.toLocaleString()}
Orders:             ${funnel.orders.toLocaleString()}

`;

  // Top Vehicles
  text += `🚗 TOP VEHICLES (30 Days)
${'-'.repeat(50)}
`;
  if (topVehicles.length > 0) {
    for (let i = 0; i < topVehicles.length; i++) {
      const v = topVehicles[i];
      text += `${i + 1}. ${v.vehicle} - ${v.orders} orders, ${formatCurrency(v.revenue)}
`;
    }
  } else {
    text += `No data\n`;
  }
  text += '\n';

  // Top Packages
  text += `📦 TOP PACKAGES (30 Days)
${'-'.repeat(50)}
`;
  if (topPackages.length > 0) {
    for (let i = 0; i < topPackages.length; i++) {
      const p = topPackages[i];
      text += `${i + 1}. ${p.wheel} + ${p.tire}
   ${p.orders} orders, ${formatCurrency(p.revenue)}
`;
    }
  } else {
    text += `No data\n`;
  }
  text += '\n';

  // Top Tire Sizes
  text += `🛞 TOP TIRE SIZES (30 Days)
${'-'.repeat(50)}
`;
  if (topTireSizes.length > 0) {
    for (let i = 0; i < topTireSizes.length; i++) {
      const t = topTireSizes[i];
      text += `${i + 1}. ${t.size} - ${t.orders} orders, ${formatCurrency(t.revenue)}
`;
    }
  } else {
    text += `No data\n`;
  }

  text += `
${'='.repeat(50)}
Generated: ${new Date(data.generatedAt).toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })}
View Full Dashboard: https://shop.warehousetiredirect.com/admin/revenue
${BRAND.name}
`;

  return text.trim();
}
