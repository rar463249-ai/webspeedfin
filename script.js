// Global variables
let currentAnalysis = null

// DOM elements
const analyzeForm = document.getElementById("analyzeForm")
const urlInput = document.getElementById("urlInput")
const loadingSection = document.getElementById("loadingSection")
const resultsSection = document.getElementById("resultsSection")
const errorSection = document.getElementById("errorSection")
const contentSection = document.getElementById("contentSection")
const loadingOverlay = document.getElementById("loadingOverlay")

function showAnalyzer() {
  // Scroll to the form section
  const form = document.getElementById("analyzeForm")
  if (form) {
    form.scrollIntoView({ behavior: "smooth" })
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  analyzeForm.addEventListener("submit", handleFormSubmit)

  const downloadButton = document.getElementById("downloadButton")
  const shareButton = document.getElementById("shareButton")

  if (downloadButton) {
    downloadButton.addEventListener("click", downloadResults)
  }

  if (shareButton) {
    shareButton.addEventListener("click", shareResults)
  }
})

// Handle form submission
async function handleFormSubmit(event) {
  event.preventDefault()

  const url = urlInput.value.trim()
  const device = "desktop" // Changed to desktop

  if (!url) {
    showError("Please enter a valid URL")
    return
  }

  // Validate URL format
  try {
    new URL(url)
  } catch (e) {
    showError("Please enter a valid URL (including http:// or https://)")
    return
  }

  await analyzeWebsite(url, device)
}

// Main analysis function
async function analyzeWebsite(url, device) {
  showFullScreenLoading()

  try {
    const response = await fetch("analyze.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        device: device,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }

    currentAnalysis = data
    displayResults(data)
  } catch (error) {
    console.error("Analysis error:", error)
    showError(error.message || "Failed to analyze website. Please try again.")
  }
}

function displayResults(data) {
  hideLoadingOverlay()
  hideAllSections()
  resultsSection.classList.remove("hidden")

  if (contentSection) {
    contentSection.style.display = "block"
  }

  // Save current analysis for future comparison
  localStorage.setItem("previousAnalysis", JSON.stringify(data))

  // Update performance grade and basic metrics
  updatePerformanceGrade(data.scores.performance)

  // Update Core Web Vitals
  updateMetric("fcp", data.metrics.fcp)
  updateMetric("lcp", data.metrics.lcp)
  updateMetric("tbt", data.metrics.tbt)
  updateMetric("cls", data.metrics.cls)
  updateMetric("si", data.metrics.si)

  // Update screenshot
  updateScreenshot(data.screenshot)

  // Update opportunities
  updateOpportunities(data.opportunities)
}

function updatePerformanceGrade(score) {
  const gradeElement = document.getElementById("performanceGrade")
  const scoreElement = document.getElementById("performanceScore")

  if (gradeElement && scoreElement) {
    let grade, bgColor
    if (score >= 90) {
      grade = "A"
      bgColor = "bg-green-500"
    } else if (score >= 80) {
      grade = "B"
      bgColor = "bg-green-400"
    } else if (score >= 70) {
      grade = "C"
      bgColor = "bg-yellow-500"
    } else if (score >= 60) {
      grade = "D"
      bgColor = "bg-orange-500"
    } else {
      grade = "F"
      bgColor = "bg-red-500"
    }

    gradeElement.textContent = grade
    gradeElement.className = `text-2xl font-bold ${bgColor} text-white px-3 py-1 rounded`
    scoreElement.textContent = score || "-1"
  }
}

function updateMetric(metricKey, metricData) {
  const valueElement = document.getElementById(`${metricKey}Value`)
  const statusElement = document.getElementById(`${metricKey}Status`)

  if (!valueElement || !statusElement || !metricData) return

  valueElement.textContent = metricData.displayValue || "-"

  // Determine status and color
  let status, colorClass
  if (metricData.score >= 0.9) {
    status = "GOOD"
    colorClass = "metric-good"
  } else if (metricData.score >= 0.5) {
    status = "NEEDS IMPROVEMENT"
    colorClass = "metric-needs-improvement"
  } else {
    status = "POOR"
    colorClass = "metric-poor"
  }

  statusElement.textContent = status
  statusElement.className = `text-xs font-medium px-2 py-1 rounded ${colorClass}`

  // Update value color
  valueElement.className = `text-2xl font-bold mb-2 ${metricData.score >= 0.9 ? "text-green-600" : metricData.score >= 0.5 ? "text-yellow-600" : "text-red-600"}`
}

// Update screenshot with enhanced display
function updateScreenshot(screenshotData) {
  const container = document.getElementById("screenshotContainer")

  if (screenshotData && screenshotData.data) {
    const screenshotHtml = `
      <img src="data:image/jpeg;base64,${screenshotData.data}" 
           alt="Website Screenshot" 
           class="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
           onclick="openScreenshotModal('${screenshotData.data}')"
           style="max-height: 240px;">
    `
    container.innerHTML = screenshotHtml
  } else {
    container.innerHTML = `
      <div class="text-center">
        <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
        <p class="text-slate-500 text-sm">Screenshot loading...</p>
      </div>
    `
  }
}

function openScreenshotModal(imageData) {
  // Create modal if it doesn't exist
  let modal = document.getElementById("screenshotModal")
  if (!modal) {
    modal = document.createElement("div")
    modal.id = "screenshotModal"
    modal.className = "fixed inset-0 bg-black bg-opacity-75 hidden z-50 flex items-center justify-center p-4"
    modal.innerHTML = `
      <div class="bg-white rounded-lg max-w-4xl max-h-full overflow-auto">
        <div class="p-4 border-b flex justify-between items-center">
          <h3 class="text-lg font-semibold">Website Screenshot</h3>
          <button onclick="closeScreenshotModal()" class="text-gray-500 hover:text-gray-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="p-4">
          <img id="modalScreenshot" src="/placeholder.svg" alt="Website Screenshot" class="max-w-full h-auto">
        </div>
      </div>
    `
    document.body.appendChild(modal)
  }

  const modalImg = document.getElementById("modalScreenshot")
  if (modalImg) {
    modalImg.src = `data:image/jpeg;base64,${imageData}`
    modal.classList.remove("hidden")
  }
}

function closeScreenshotModal() {
  const modal = document.getElementById("screenshotModal")
  if (modal) {
    modal.classList.add("hidden")
  }
}

// Update opportunities section
function updateOpportunities(opportunities) {
  const container = document.getElementById("opportunitiesContainer")

  if (!opportunities || opportunities.length === 0) {
    container.innerHTML = '<p class="text-slate-500">No optimization opportunities found</p>'
    return
  }

  const html = opportunities
    .map((opportunity, index) => {
      const priority = getOpportunityPriority(opportunity.score)

      return `
        <div class="opportunity-card border border-gray-200 rounded-lg p-4 mb-3 hover:shadow-md transition-shadow">
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center space-x-3">
              <div class="opportunity-icon ${priority.colorClass} w-6 h-6 rounded-full flex items-center justify-center">
                <span class="text-white text-xs font-bold">${index + 1}</span>
              </div>
              <div>
                <h4 class="font-semibold text-slate-700">${opportunity.title}</h4>
                <span class="priority-badge ${priority.badgeClass} text-xs px-2 py-1 rounded-full font-medium mt-1 inline-block">
                  ${priority.label}
                </span>
              </div>
            </div>
          </div>
          
          <p class="text-slate-600 text-sm mb-2">${opportunity.description}</p>
          
          ${
            opportunity.savings
              ? `
            <div class="savings-highlight bg-orange-50 border border-orange-200 rounded-lg p-2">
              <div class="flex items-center space-x-2">
                <svg class="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                </svg>
                <span class="text-orange-800 font-medium text-sm">Potential savings: ${opportunity.savings}</span>
              </div>
            </div>
          `
              : ""
          }
        </div>
      `
    })
    .join("")

  container.innerHTML = html
}

function getOpportunityPriority(score) {
  if (score <= 0.5) return { label: "High", colorClass: "bg-red-500", badgeClass: "bg-red-100 text-red-800" }
  if (score <= 0.8) return { label: "Medium", colorClass: "bg-yellow-500", badgeClass: "bg-yellow-100 text-yellow-800" }
  return { label: "Low", colorClass: "bg-green-500", badgeClass: "bg-green-100 text-green-800" }
}

function downloadResults() {
  if (!currentAnalysis) {
    alert("No analysis data available to download")
    return
  }

  // Create HAR-like data structure
  const harData = {
    log: {
      version: "1.2",
      creator: {
        name: "SpeedAnalyzer",
        version: "1.0",
      },
      pages: [
        {
          startedDateTime: new Date(currentAnalysis.timestamp).toISOString(),
          id: "page_1",
          title: currentAnalysis.url,
          pageTimings: {
            onContentLoad: currentAnalysis.metrics.fcp?.numericValue || -1,
            onLoad: currentAnalysis.metrics.lcp?.numericValue || -1,
          },
        },
      ],
      entries: [],
    },
  }

  const dataStr = JSON.stringify(harData, null, 2)
  const dataBlob = new Blob([dataStr], { type: "application/json" })

  const link = document.createElement("a")
  link.href = URL.createObjectURL(dataBlob)
  link.download = `performance-analysis-${new Date().toISOString().split("T")[0]}.har`
  link.click()
}

function shareResults() {
  if (!currentAnalysis) {
    alert("No analysis data available to share")
    return
  }

  const shareData = {
    title: `Performance Analysis - ${currentAnalysis.url}`,
    text: `Performance analysis results for ${currentAnalysis.url}`,
    url: window.location.href,
  }

  if (navigator.share) {
    navigator.share(shareData)
  } else {
    // Fallback: copy to clipboard
    const shareText = `Performance Analysis Results\nURL: ${currentAnalysis.url}\nPerformance Score: ${currentAnalysis.scores.performance}/100\nAnalyzed: ${new Date(currentAnalysis.timestamp).toLocaleString()}`

    navigator.clipboard
      .writeText(shareText)
      .then(() => {
        alert("Results copied to clipboard!")
      })
      .catch(() => {
        alert("Unable to share results. Please copy the URL manually.")
      })
  }
}

// Show loading state
function showLoading() {
  hideAllSections()
  loadingSection.classList.remove("hidden")

  if (contentSection) {
    contentSection.style.display = "block"
  }
}

// Show error state
function showError(message) {
  hideLoadingOverlay()
  hideAllSections()
  document.getElementById("errorMessage").textContent = message
  errorSection.classList.remove("hidden")

  // Show content section again on error
  if (contentSection) {
    contentSection.style.display = "block"
  }
}

// Hide all sections
function hideAllSections() {
  loadingSection.classList.add("hidden")
  resultsSection.classList.add("hidden")
  errorSection.classList.add("hidden")
}

// Reset form and hide results
function resetForm() {
  hideLoadingOverlay()
  hideAllSections()
  urlInput.value = ""
  currentAnalysis = null

  // Show content section again
  if (contentSection) {
    contentSection.style.display = "block"
  }
}

// Add keyboard event listener for modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeScreenshotModal()
  }
})

function showFullScreenLoading() {
  if (loadingOverlay) {
    loadingOverlay.classList.remove("hidden")
  }
  if (contentSection) {
    contentSection.style.display = "block"
  }
}

function hideLoadingOverlay() {
  if (loadingOverlay) {
    loadingOverlay.classList.add("hidden")
  }
}
