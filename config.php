<?php
/**
 * Configuration file for SpeedAnalyzer
 */

// Google PageSpeed Insights API Configuration
define('PAGESPEED_API_KEY', 'YOUR_GOOGLE_PAGESPEED_API_KEY');
define('PAGESPEED_API_URL', 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed');

// Application Configuration
define('APP_NAME', 'SpeedAnalyzer');
define('APP_VERSION', '1.0.0');
define('MAX_ANALYSIS_TIME', 60); // seconds

// Rate limiting (optional)
define('RATE_LIMIT_ENABLED', false);
define('RATE_LIMIT_REQUESTS', 10); // requests per hour per IP
define('RATE_LIMIT_WINDOW', 3600); // 1 hour in seconds

// Caching (optional)
define('CACHE_ENABLED', false);
define('CACHE_DURATION', 3600); // 1 hour in seconds
define('CACHE_DIR', __DIR__ . '/cache/');

// Error reporting
define('DEBUG_MODE', false);

// CORS settings
define('CORS_ENABLED', true);
define('CORS_ORIGINS', ['*']); // Allow all origins, restrict in production

// Logging
define('LOG_ENABLED', true);
define('LOG_FILE', __DIR__ . '/logs/app.log');

/**
 * Initialize application
 */
function initializeApp() {
    // Set error reporting based on debug mode
    if (DEBUG_MODE) {
        error_reporting(E_ALL);
        ini_set('display_errors', 1);
    } else {
        error_reporting(0);
        ini_set('display_errors', 0);
    }
    
    // Create necessary directories
    if (CACHE_ENABLED && !is_dir(CACHE_DIR)) {
        mkdir(CACHE_DIR, 0755, true);
    }
    
    if (LOG_ENABLED && !is_dir(dirname(LOG_FILE))) {
        mkdir(dirname(LOG_FILE), 0755, true);
    }
}

/**
 * Validate API key
 */
function validateApiKey() {
    if (PAGESPEED_API_KEY === 'YOUR_GOOGLE_PAGESPEED_API_KEY') {
        throw new Exception('Please configure your Google PageSpeed Insights API key in config.php');
    }
    
    if (empty(PAGESPEED_API_KEY)) {
        throw new Exception('Google PageSpeed Insights API key is required');
    }
}

// Initialize the application
initializeApp();
?>
