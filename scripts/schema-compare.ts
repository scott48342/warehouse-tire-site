/**
 * DB vs Drizzle Schema Comparison
 * Run: npx tsx scripts/schema-compare.ts
 */

// ACTUAL DB COLUMNS (from introspection)
const dbSchema: Record<string, string[]> = {
  email_campaigns: [
    'id', 'name', 'campaign_type', 'status', 'subject', 'preview_text', 'from_name', 'reply_to',
    'template_key', 'content_json', 'audience_rules_json', 'scheduled_for', 'send_mode',
    'monthly_rule_json', 'include_free_shipping_banner', 'include_price_match', 'utm_campaign',
    'total_recipients', 'sent_count', 'delivered_count', 'open_count', 'click_count',
    'bounce_count', 'complaint_count', 'unsubscribe_count', 'is_test', 'created_at', 'updated_at',
    'started_at', 'completed_at', 'created_by', 'notes', 'discount_enabled', 'discount_percent',
    'discount_expiry_hours', 'discount_single_use', 'discount_issued_count', 'discount_redeemed_count',
    'discount_revenue'
  ],
  abandoned_carts: [
    'id', 'cart_id', 'session_id', 'customer_first_name', 'customer_last_name', 'customer_email',
    'customer_phone', 'vehicle_year', 'vehicle_make', 'vehicle_model', 'vehicle_trim', 'items',
    'item_count', 'subtotal', 'estimated_total', 'status', 'recovered_order_id', 'recovered_at',
    'created_at', 'updated_at', 'last_activity_at', 'abandoned_at', 'source', 'user_agent',
    'ip_address', 'first_email_sent_at', 'second_email_sent_at', 'email_sent_count',
    'recovered_after_email', 'unsubscribed', 'third_email_sent_at', 'last_email_status',
    'is_test', 'test_reason', 'email_opened_at', 'email_clicked_at', 'email_open_count',
    'email_click_count', 'hostname'
  ],
  cart_add_events: [
    'id', 'product_type', 'sku', 'rear_sku', 'product_name', 'brand', 'price_at_time', 'quantity',
    'size', 'specs', 'cart_id', 'session_id', 'vehicle_year', 'vehicle_make', 'vehicle_model',
    'vehicle_trim', 'source', 'referrer', 'purchased', 'order_id', 'purchased_at', 'is_test',
    'test_reason', 'created_at', 'ip_address', 'user_agent'
  ],
  email_subscribers: [
    'id', 'email', 'source', 'vehicle_year', 'vehicle_make', 'vehicle_model', 'vehicle_trim',
    'cart_id', 'marketing_consent', 'unsubscribed', 'unsubscribed_at', 'created_at', 'updated_at',
    'ip_address', 'user_agent', 'is_test', 'test_reason', 'unsubscribe_token', 'suppression_reason',
    'suppressed_at', 'last_active_at', 'last_cart_at', 'last_order_at', 'last_campaign_sent_at'
  ],
  wheel_size_trim_mappings: [
    'id', 'year', 'make', 'model', 'our_trim', 'our_modification_id', 'vehicle_fitment_id',
    'ws_slug', 'ws_generation', 'ws_modification_name', 'ws_submodel', 'ws_trim', 'ws_engine',
    'ws_body', 'match_method', 'match_confidence', 'match_score', 'config_count', 'has_single_config',
    'default_config_id', 'default_wheel_diameter', 'default_tire_size', 'all_wheel_diameters',
    'all_tire_sizes', 'needs_review', 'review_reason', 'review_priority', 'reviewed_by',
    'reviewed_at', 'review_notes', 'status', 'created_at', 'updated_at'
  ],
  vehicle_fitment_configurations: [
    'id', 'vehicle_fitment_id', 'year', 'make_key', 'model_key', 'modification_id', 'display_trim',
    'configuration_key', 'configuration_label', 'wheel_diameter', 'wheel_width', 'wheel_offset_mm',
    'tire_size', 'axle_position', 'is_default', 'is_optional', 'source', 'source_confidence',
    'source_notes', 'created_at', 'updated_at'
  ],
  catalog_makes: ['id', 'slug', 'name', 'created_at', 'updated_at'],
  catalog_models: ['id', 'make_slug', 'slug', 'name', 'years', 'created_at', 'updated_at'],
  analytics_sessions: [
    'id', 'session_id', 'first_seen_at', 'last_seen_at', 'landing_page', 'referrer', 'utm_source',
    'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'device_type', 'user_agent', 'is_bot',
    'country', 'page_view_count', 'is_test', 'test_reason', 'hostname', 'current_page', 'city', 'region'
  ],
  analytics_pageviews: ['id', 'session_id', 'path', 'timestamp', 'hostname']
};

// DRIZZLE SCHEMA COLUMNS (from schema files)
const drizzleSchema: Record<string, string[]> = {
  email_campaigns: [
    'id', 'name', 'campaign_type', 'status', 'subject', 'preview_text', 'from_name', 'reply_to',
    'template_key', 'content_json', 'audience_rules_json', 'scheduled_for', 'send_mode',
    'monthly_rule_json', 'include_free_shipping_banner', 'include_price_match', 'utm_campaign',
    'total_recipients', 'sent_count', 'delivered_count', 'open_count', 'click_count',
    'bounce_count', 'complaint_count', 'unsubscribe_count', 'is_test', 'created_at', 'updated_at',
    'started_at', 'completed_at', 'created_by', 'notes', 'discount_enabled', 'discount_percent',
    'discount_expiry_hours', 'discount_single_use', 'discount_issued_count', 'discount_redeemed_count',
    'discount_revenue'
  ],
  abandoned_carts: [
    'id', 'cart_id', 'session_id', 'customer_first_name', 'customer_last_name', 'customer_email',
    'customer_phone', 'vehicle_year', 'vehicle_make', 'vehicle_model', 'vehicle_trim', 'items',
    'item_count', 'subtotal', 'estimated_total', 'status', 'recovered_order_id', 'recovered_at',
    'created_at', 'updated_at', 'last_activity_at', 'abandoned_at', 'source', 'user_agent',
    'ip_address', 'first_email_sent_at', 'second_email_sent_at', 'email_sent_count',
    'recovered_after_email', 'unsubscribed', 'third_email_sent_at', 'last_email_status',
    'is_test', 'test_reason', 'email_opened_at', 'email_clicked_at', 'email_open_count',
    'email_click_count', 'hostname'
  ],
  cart_add_events: [
    'id', 'product_type', 'sku', 'rear_sku', 'product_name', 'brand', 'price_at_time', 'quantity',
    'size', 'specs', 'cart_id', 'session_id', 'vehicle_year', 'vehicle_make', 'vehicle_model',
    'vehicle_trim', 'source', 'referrer', 'purchased', 'order_id', 'purchased_at', 'is_test',
    'test_reason', 'created_at', 'ip_address', 'user_agent'
  ],
  email_subscribers: [
    'id', 'email', 'source', 'vehicle_year', 'vehicle_make', 'vehicle_model', 'vehicle_trim',
    'cart_id', 'marketing_consent', 'unsubscribed', 'unsubscribed_at', 'created_at', 'updated_at',
    'ip_address', 'user_agent', 'is_test', 'test_reason', 'unsubscribe_token', 'suppression_reason',
    'suppressed_at', 'last_active_at', 'last_cart_at', 'last_order_at', 'last_campaign_sent_at'
  ],
  wheel_size_trim_mappings: [
    // Drizzle schema has DIFFERENT columns than actual DB!
    'id', 'year', 'make_key', 'make', 'model_key', 'model', 'our_display_trim', 'our_trim', 'trim',
    'our_modification_id', 'vehicle_fitment_id', 'wheel_size_generation', 'wheel_size_trim_name',
    'ws_trim', 'ws_engine', 'config_count', 'has_single_config', 'default_wheel_diameter',
    'wheel_size_modification_id', 'match_method', 'match_confidence', 'status', 'needs_review',
    'review_reason', 'review_notes', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at'
  ],
  vehicle_fitment_configurations: [
    // Drizzle schema has DIFFERENT columns than actual DB!
    'id', 'year', 'make_key', 'make_display', 'model_key', 'model_display', 'display_trim',
    'generation', 'bolt_pattern', 'center_bore_mm', 'thread_size', 'seat_type', 'offset_min_mm',
    'offset_max_mm', 'wheel_diameter', 'wheel_width', 'tire_size', 'is_oem', 'is_front_axle',
    'axle_position', 'source', 'notes', 'created_at', 'updated_at'
  ],
  catalog_makes: ['id', 'slug', 'name', 'created_at', 'updated_at'],
  catalog_models: ['id', 'make_slug', 'slug', 'name', 'years', 'created_at', 'updated_at'],
  analytics_sessions: [
    'id', 'session_id', 'first_seen_at', 'last_seen_at', 'landing_page', 'referrer', 'utm_source',
    'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'device_type', 'user_agent', 'is_bot',
    'country', 'page_view_count', 'is_test', 'test_reason', 'hostname', 'current_page', 'city', 'region'
  ],
  analytics_pageviews: ['id', 'session_id', 'path', 'timestamp', 'hostname']
};

console.log('\n' + '='.repeat(80));
console.log(' DB vs DRIZZLE SCHEMA COMPARISON REPORT');
console.log(' Generated: ' + new Date().toISOString());
console.log('='.repeat(80));

let totalMismatches = 0;

for (const table of Object.keys(dbSchema)) {
  const dbCols = new Set(dbSchema[table]);
  const drizzleCols = new Set(drizzleSchema[table] || []);
  
  const inDbNotDrizzle = [...dbCols].filter(c => !drizzleCols.has(c));
  const inDrizzleNotDb = [...drizzleCols].filter(c => !dbCols.has(c));
  
  if (inDbNotDrizzle.length > 0 || inDrizzleNotDb.length > 0) {
    console.log(`\n### ${table.toUpperCase()}`);
    console.log(`DB columns: ${dbCols.size} | Drizzle columns: ${drizzleCols.size}`);
    
    if (inDbNotDrizzle.length > 0) {
      console.log(`\n❌ IN DB BUT MISSING FROM DRIZZLE (${inDbNotDrizzle.length}):`);
      inDbNotDrizzle.forEach(c => console.log(`   - ${c}`));
      totalMismatches += inDbNotDrizzle.length;
    }
    
    if (inDrizzleNotDb.length > 0) {
      console.log(`\n⚠️ IN DRIZZLE BUT NOT IN DB (${inDrizzleNotDb.length}):`);
      inDrizzleNotDb.forEach(c => console.log(`   - ${c} [WILL CAUSE RUNTIME ERROR]`));
      totalMismatches += inDrizzleNotDb.length;
    }
  } else {
    console.log(`\n✅ ${table}: MATCH (${dbCols.size} columns)`);
  }
}

console.log('\n' + '='.repeat(80));
console.log(` TOTAL MISMATCHES: ${totalMismatches}`);
console.log('='.repeat(80));
