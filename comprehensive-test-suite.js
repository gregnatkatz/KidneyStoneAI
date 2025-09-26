/**
 * Kidney Stone Research Platform - Comprehensive Test Suite
 * Developed by Gregory Katz (@gregorykatz_microsoft)
 * 
 * Purpose: 20-test validation suite for comprehensive functionality testing
 * Dependencies: Node.js, File system operations
 * Last Updated: September 26, 2025
 */


/**
 * Kidney Stone Research Platform - Comprehensive Test Suite
 * Developed by Greg Katz
 * 
 * Purpose: Execute 20 comprehensive functionality tests across all risk categories
 * Dependencies: Node.js, fetch API for backend testing
 * Last Updated: September 25, 2025
 */

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:8002';

// REM: Load test dataset with 20 comprehensive test cases
const testDataset = require('./test-dataset.json');

class KidneyStoneTestSuite {
  constructor() {
    this.results = [];
    this.passedTests = 0;
    this.failedTests = 0;
  }

  // REM: Execute comprehensive test for a single patient
  async executePatientTest(testPatient) {
    const testResult = {
      patientId: testPatient.id,
      patientName: testPatient.name,
      scenario: testPatient.scenario,
      riskLevel: testPatient.riskLevel,
      passed: false,
      confidence: 0,
      errors: [],
      findings: []
    };

    try {
      // REM: Test 1 - Patient imaging endpoint
      const imagingResponse = await fetch(`${API_BASE_URL}/patients/${testPatient.id}/imaging`);
      if (!imagingResponse.ok) {
        testResult.errors.push('Failed to fetch patient imaging data');
      } else {
        const imagingData = await imagingResponse.json();
        testResult.findings.push(`Found ${imagingData.imaging_studies?.length || 0} imaging studies`);
      }

      // REM: Test 2 - Multi-model analysis endpoint
      const analysisResponse = await fetch(`${API_BASE_URL}/analysis/run/${testPatient.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!analysisResponse.ok) {
        testResult.errors.push('Failed to run multi-model analysis');
      } else {
        const analysisData = await analysisResponse.json();
        testResult.confidence = analysisData.analysis_metadata?.confidence_score || 0;
        testResult.findings.push(`Analysis confidence: ${testResult.confidence}`);
        
        // REM: Validate expected findings match analysis results
        const expectedFindings = testPatient.expected_findings || [];
        const actualFindings = analysisData.clinical_findings?.primary?.diagnosis || '';
        
        let findingsMatch = 0;
        expectedFindings.forEach(expected => {
          if (actualFindings.toLowerCase().includes(expected.toLowerCase())) {
            findingsMatch++;
          }
        });
        
        const findingsAccuracy = expectedFindings.length > 0 ? findingsMatch / expectedFindings.length : 1;
        testResult.findings.push(`Findings accuracy: ${Math.round(findingsAccuracy * 100)}%`);
        
        // REM: Test passes if confidence > 40% and findings accuracy > 70%
        testResult.passed = testResult.confidence > 0.4 && findingsAccuracy > 0.7;
      }

      // REM: Test 3 - Image loading validation
      if (imagingResponse.ok) {
        const imagingData = await imagingResponse.json();
        const imageTests = await Promise.all(
          (imagingData.imaging_studies || []).slice(0, 3).map(async (study) => {
            try {
              const imageResponse = await fetch(`${API_BASE_URL}${study.imagePath}`);
              return imageResponse.ok;
            } catch {
              return false;
            }
          })
        );
        
        const imageLoadSuccess = imageTests.filter(Boolean).length / Math.max(imageTests.length, 1);
        testResult.findings.push(`Image loading success: ${Math.round(imageLoadSuccess * 100)}%`);
      }

    } catch (error) {
      testResult.errors.push(`Test execution error: ${error.message}`);
    }

    return testResult;
  }

  // REM: Execute all 20 comprehensive functionality tests
  async runComprehensiveTests() {
    console.log('🧪 Starting Kidney Stone Research Platform - Comprehensive Test Suite');
    console.log('📊 Testing 20 patient scenarios across all risk categories\n');

    const testPatients = testDataset.test_patients;
    
    for (const testPatient of testPatients) {
      console.log(`🔬 Testing: ${testPatient.name} (${testPatient.riskLevel} Risk)`);
      console.log(`📋 Scenario: ${testPatient.scenario}`);
      
      const result = await this.executePatientTest(testPatient);
      this.results.push(result);
      
      if (result.passed) {
        this.passedTests++;
        console.log(`✅ PASSED - Confidence: ${Math.round(result.confidence * 100)}%`);
      } else {
        this.failedTests++;
        console.log(`❌ FAILED - Errors: ${result.errors.join(', ')}`);
      }
      
      result.findings.forEach(finding => console.log(`   📝 ${finding}`));
      console.log('');
    }

    this.generateTestReport();
  }

  // REM: Generate comprehensive test report with confidence metrics
  generateTestReport() {
    console.log('📈 COMPREHENSIVE TEST RESULTS SUMMARY');
    console.log('=' .repeat(50));
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${this.passedTests} (${Math.round(this.passedTests / this.results.length * 100)}%)`);
    console.log(`Failed: ${this.failedTests} (${Math.round(this.failedTests / this.results.length * 100)}%)`);
    console.log('');

    // REM: Breakdown by risk category
    const riskBreakdown = {
      'High': { passed: 0, total: 0 },
      'Moderate': { passed: 0, total: 0 },
      'Low': { passed: 0, total: 0 }
    };

    this.results.forEach(result => {
      riskBreakdown[result.riskLevel].total++;
      if (result.passed) riskBreakdown[result.riskLevel].passed++;
    });

    console.log('📊 RESULTS BY RISK CATEGORY:');
    Object.entries(riskBreakdown).forEach(([risk, stats]) => {
      const percentage = stats.total > 0 ? Math.round(stats.passed / stats.total * 100) : 0;
      console.log(`   ${risk} Risk: ${stats.passed}/${stats.total} (${percentage}%)`);
    });
    console.log('');

    // REM: Confidence score analysis
    const confidenceScores = this.results.map(r => r.confidence).filter(c => c > 0);
    const avgConfidence = confidenceScores.length > 0 
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length 
      : 0;

    console.log('🎯 CONFIDENCE ANALYSIS:');
    console.log(`   Average Confidence: ${Math.round(avgConfidence * 100)}%`);
    console.log(`   High Confidence (>85%): ${confidenceScores.filter(c => c > 0.85).length}`);
    console.log(`   Medium Confidence (60-85%): ${confidenceScores.filter(c => c >= 0.6 && c <= 0.85).length}`);
    console.log(`   Low Confidence (<60%): ${confidenceScores.filter(c => c < 0.6).length}`);
    console.log('');

    // REM: Failed test details
    const failedResults = this.results.filter(r => !r.passed);
    if (failedResults.length > 0) {
      console.log('❌ FAILED TEST DETAILS:');
      failedResults.forEach(result => {
        console.log(`   ${result.patientName}: ${result.errors.join(', ')}`);
      });
      console.log('');
    }

    // REM: Success criteria validation
    const overallSuccess = this.passedTests >= 16; // 80% pass rate required
    const avgConfidenceAcceptable = avgConfidence >= 0.6; // 60% average confidence required
    
    console.log('🏆 SUCCESS CRITERIA VALIDATION:');
    console.log(`   Overall Pass Rate (≥80%): ${overallSuccess ? '✅' : '❌'} ${Math.round(this.passedTests / this.results.length * 100)}%`);
    console.log(`   Average Confidence (≥60%): ${avgConfidenceAcceptable ? '✅' : '❌'} ${Math.round(avgConfidence * 100)}%`);
    console.log(`   Medical Image Loading: ${this.results.some(r => r.findings.some(f => f.includes('Image loading'))) ? '✅' : '❌'}`);
    console.log(`   Clinical Analysis Integration: ${this.results.some(r => r.confidence > 0) ? '✅' : '❌'}`);
    
    const allCriteriaMet = overallSuccess && avgConfidenceAcceptable;
    console.log(`\n🎯 OVERALL RESULT: ${allCriteriaMet ? '✅ SUCCESS' : '❌ NEEDS IMPROVEMENT'}`);
    
    if (!allCriteriaMet) {
      console.log('\n📋 IMPROVEMENT RECOMMENDATIONS:');
      if (!overallSuccess) console.log('   - Improve test pass rate by fixing failed scenarios');
      if (!avgConfidenceAcceptable) console.log('   - Enhance AI model confidence through better data quality');
      console.log('   - Review failed test cases for common patterns');
      console.log('   - Validate medical image loading mechanisms');
    }
  }
}

// REM: Execute test suite if run directly
if (require.main === module) {
  const testSuite = new KidneyStoneTestSuite();
  testSuite.runComprehensiveTests().catch(console.error);
}

module.exports = KidneyStoneTestSuite;
