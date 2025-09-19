<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Configuration
const API_KEY = 'YOUR_GOOGLE_PAGESPEED_API_KEY'; // Replace with your actual API key
const API_BASE_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// Get input data
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['url'])) {
    http_response_code(400);
    echo json_encode(['error' => 'URL is required']);
    exit;
}

$url = filter_var($input['url'], FILTER_VALIDATE_URL);
if (!$url) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid URL format']);
    exit;
}

$device = isset($input['device']) ? $input['device'] : 'mobile';
if (!in_array($device, ['mobile', 'desktop'])) {
    $device = 'mobile';
}

try {
    // Analyze the website
    $result = analyzeWebsite($url, $device);
    echo json_encode($result);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

/**
 * Analyze website using Google PageSpeed Insights API
 */
function analyzeWebsite($url, $device) {
    // Build API URL with parameters
    $apiUrl = API_BASE_URL . '?' . http_build_query([
        'url' => $url,
        'key' => API_KEY,
        'strategy' => strtoupper($device),
        'category' => ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO'],
        'locale' => 'en'
    ]);

    // Make API request
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 60,
            'header' => [
                'User-Agent: SpeedAnalyzer/1.0'
            ]
        ]
    ]);

    $response = file_get_contents($apiUrl, false, $context);
    
    if ($response === false) {
        throw new Exception('Failed to connect to PageSpeed Insights API');
    }

    $data = json_decode($response, true);
    
    if (!$data) {
        throw new Exception('Invalid response from PageSpeed Insights API');
    }

    if (isset($data['error'])) {
        throw new Exception('API Error: ' . $data['error']['message']);
    }

    // Process and format the results
    return processResults($data, $url);
}

/**
 * Process and format PageSpeed Insights results
 */
function processResults($data, $url) {
    $lighthouse = $data['lighthouseResult'];
    $categories = $lighthouse['categories'];
    $audits = $lighthouse['audits'];

    // Extract scores
    $scores = [
        'performance' => round($categories['performance']['score'] * 100),
        'accessibility' => round($categories['accessibility']['score'] * 100),
        'bestPractices' => round($categories['best-practices']['score'] * 100),
        'seo' => round($categories['seo']['score'] * 100)
    ];

    // Extract Core Web Vitals metrics
    $metrics = [
        'fcp' => formatMetric($audits['first-contentful-paint']),
        'lcp' => formatMetric($audits['largest-contentful-paint']),
        'tbt' => formatMetric($audits['total-blocking-time']),
        'cls' => formatMetric($audits['cumulative-layout-shift']),
        'si' => formatMetric($audits['speed-index'])
    ];

    $screenshot = extractScreenshot($audits);

    // Extract opportunities (performance improvements)
    $opportunities = [];
    foreach ($audits as $auditId => $audit) {
        if (isset($audit['details']['type']) && 
            $audit['details']['type'] === 'opportunity' && 
            isset($audit['numericValue']) && 
            $audit['numericValue'] > 0) {
            
            $opportunities[] = [
                'id' => $auditId,
                'title' => $audit['title'],
                'description' => $audit['description'],
                'savings' => isset($audit['displayValue']) ? $audit['displayValue'] : null,
                'score' => $audit['score']
            ];
        }
    }

    // Sort opportunities by potential savings (score)
    usort($opportunities, function($a, $b) {
        return $a['score'] <=> $b['score'];
    });

    // Extract diagnostics (other issues)
    $diagnostics = [];
    $diagnosticAudits = [
        'unused-javascript',
        'unused-css-rules',
        'render-blocking-resources',
        'uses-long-cache-ttl',
        'efficient-animated-content',
        'mainthread-work-breakdown',
        'bootup-time',
        'uses-rel-preconnect',
        'font-display',
        'third-party-summary'
    ];

    foreach ($diagnosticAudits as $auditId) {
        if (isset($audits[$auditId]) && $audits[$auditId]['score'] < 1) {
            $audit = $audits[$auditId];
            $diagnostics[] = [
                'id' => $auditId,
                'title' => $audit['title'],
                'description' => $audit['description'],
                'score' => $audit['score']
            ];
        }
    }

    // Prepare final result
    $result = [
        'url' => $url,
        'timestamp' => date('c'),
        'device' => strtolower($data['analysisUTCTimestamp'] ?? 'mobile'),
        'scores' => $scores,
        'metrics' => $metrics,
        'screenshot' => $screenshot,
        'opportunities' => array_slice($opportunities, 0, 10), // Limit to top 10
        'diagnostics' => array_slice($diagnostics, 0, 10), // Limit to top 10
        'rawData' => [
            'loadingExperience' => $data['loadingExperience'] ?? null,
            'originLoadingExperience' => $data['originLoadingExperience'] ?? null
        ]
    ];

    return $result;
}

/**
 * Extract screenshot with multiple fallback options
 */
function extractScreenshot($audits) {
    // Try different screenshot audit types
    $screenshotAudits = [
        'final-screenshot',
        'screenshot-thumbnails',
        'full-page-screenshot'
    ];
    
    foreach ($screenshotAudits as $auditType) {
        if (isset($audits[$auditType])) {
            $audit = $audits[$auditType];
            
            // Handle final-screenshot
            if ($auditType === 'final-screenshot' && isset($audit['details']['data'])) {
                return [
                    'data' => str_replace('data:image/jpeg;base64,', '', $audit['details']['data']),
                    'timestamp' => $audit['details']['timestamp'] ?? null,
                    'type' => 'final',
                    'width' => $audit['details']['width'] ?? null,
                    'height' => $audit['details']['height'] ?? null
                ];
            }
            
            // Handle screenshot-thumbnails
            if ($auditType === 'screenshot-thumbnails' && isset($audit['details']['items'])) {
                $items = $audit['details']['items'];
                if (!empty($items) && isset($items[0]['data'])) {
                    return [
                        'data' => str_replace('data:image/jpeg;base64,', '', $items[0]['data']),
                        'timestamp' => $items[0]['timing'] ?? null,
                        'type' => 'thumbnail',
                        'width' => null,
                        'height' => null
                    ];
                }
            }
            
            // Handle full-page-screenshot
            if ($auditType === 'full-page-screenshot' && isset($audit['details']['screenshot']['data'])) {
                return [
                    'data' => str_replace('data:image/jpeg;base64,', '', $audit['details']['screenshot']['data']),
                    'timestamp' => null,
                    'type' => 'full-page',
                    'width' => $audit['details']['screenshot']['width'] ?? null,
                    'height' => $audit['details']['screenshot']['height'] ?? null
                ];
            }
        }
    }
    
    // If no screenshot found, try to generate one using external service
    return generateFallbackScreenshot($GLOBALS['url'] ?? '');
}

/**
 * Generate fallback screenshot using external service
 */
function generateFallbackScreenshot($url) {
    if (empty($url)) {
        return null;
    }
    
    // Use a free screenshot service as fallback
    $screenshotServices = [
        'https://api.screenshotmachine.com/?key=demo&url=' . urlencode($url) . '&dimension=1024x768&format=jpg',
        'https://htmlcsstoimage.com/demo_images/image.jpeg', // Demo image
    ];
    
    foreach ($screenshotServices as $serviceUrl) {
        try {
            $context = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'timeout' => 30,
                    'header' => [
                        'User-Agent: SpeedAnalyzer/1.0'
                    ]
                ]
            ]);
            
            $imageData = file_get_contents($serviceUrl, false, $context);
            
            if ($imageData !== false) {
                return [
                    'data' => base64_encode($imageData),
                    'timestamp' => time(),
                    'type' => 'fallback',
                    'width' => 1024,
                    'height' => 768,
                    'service' => 'external'
                ];
            }
        } catch (Exception $e) {
            // Continue to next service
            continue;
        }
    }
    
    return null;
}

/**
 * Format individual metric data
 */
function formatMetric($audit) {
    if (!$audit) {
        return [
            'value' => null,
            'displayValue' => 'N/A',
            'rating' => 'poor'
        ];
    }

    $value = $audit['numericValue'] ?? 0;
    $displayValue = $audit['displayValue'] ?? 'N/A';
    
    // Determine rating based on audit score
    $score = $audit['score'] ?? 0;
    if ($score >= 0.9) {
        $rating = 'good';
    } elseif ($score >= 0.5) {
        $rating = 'needs-improvement';
    } else {
        $rating = 'poor';
    }

    return [
        'value' => $value,
        'displayValue' => $displayValue,
        'rating' => $rating,
        'score' => $score
    ];
}

/**
 * Log errors for debugging
 */
function logError($message, $context = []) {
    $logEntry = [
        'timestamp' => date('c'),
        'message' => $message,
        'context' => $context
    ];
    
    error_log(json_encode($logEntry));
}
?>
