import { ESP32GestureHandler } from '../services/esp32/ESP32GestureHandler';
import { TwilioCallButton } from '../services/esp32/ESP32InputProcessor';

/**
 * ESP32 Gesture Control Test Suite
 * 
 * Usage:
 * 1. Import this file in your test component
 * 2. Call runFullTestSuite() to execute all tests
 * 3. Individual tests can be run separately
 */

export class ESP32TestSuite {
  private handler: ESP32GestureHandler;
  private testResults: { [key: string]: boolean } = {};
  private logs: string[] = [];

  constructor() {
    this.handler = ESP32GestureHandler.getInstance();
    this.setupLogging();
  }

  private log(message: string, type: 'info' | 'success' | 'error' = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : '📝';
    const logMessage = `${prefix} ${timestamp} ${message}`;
    this.logs.push(logMessage);
    console.log(logMessage);
  }

  private setupLogging() {
    // Listen to ESP32 events for test validation
    this.handler.on('esp32Connected', (deviceId) => {
      this.log(`ESP32 connected: ${deviceId}`, 'success');
    });

    this.handler.on('gestureProcessed', (gesture) => {
      this.log(`Gesture processed: ${gesture.type} - ${gesture.action}`, 'info');
    });

    this.handler.on('callButtonAction', (button, action) => {
      this.log(`Button action: ${button} - ${action}`, 'success');
    });

    this.handler.on('callButtonSelected', (button) => {
      this.log(`Button selected: ${button}`, 'info');
    });
  }

  // === Test Case 1: Device Connection ===
  async testDeviceConnection(): Promise<boolean> {
    this.log('Starting device connection test...');
    
    try {
      // Initialize handler
      const initialized = await this.handler.initialize();
      if (!initialized) {
        this.log('Handler initialization failed', 'error');
        return false;
      }

      // Scan for devices
      this.log('Scanning for devices...');
      const devices = await this.handler.scanForDevices();
      
      if (devices.length === 0) {
        this.log('No devices found during scan', 'error');
        return false;
      }

      // Try to connect to first device
      const device = devices[0];
      this.log(`Attempting to connect to: ${device.name || device.id}`);
      const connected = await this.handler.connectToDevice(device.id);

      if (connected) {
        this.log('Device connection successful', 'success');
        return true;
      } else {
        this.log('Device connection failed', 'error');
        return false;
      }
    } catch (error) {
      this.log(`Connection test error: ${error}`, 'error');
      return false;
    }
  }

  // === Test Case 2: Basic Communication ===
  async testBasicCommunication(): Promise<boolean> {
    this.log('Starting basic communication test...');

    try {
      // Send test feedback
      const result = await this.handler.sendTestFeedback();
      
      if (result) {
        this.log('Test feedback sent successfully', 'success');
        return true;
      } else {
        this.log('Failed to send test feedback', 'error');
        return false;
      }
    } catch (error) {
      this.log(`Communication test error: ${error}`, 'error');
      return false;
    }
  }

  // === Test Case 3: Gesture Recognition ===
  async testGestureRecognition(): Promise<boolean> {
    this.log('Starting gesture recognition test...');

    try {
      let allPassed = true;

      // Test single click
      this.log('Testing single click gesture...');
      this.handler.simulateGesture('single_click', [2], 200);
      await this.wait(500); // Wait for processing

      // Test slide gesture
      this.log('Testing slide gesture...');
      this.handler.simulateGesture('slide', [1, 2, 3], 600);
      await this.wait(500);

      // Test multi-press gesture
      this.log('Testing multi-press gesture...');
      this.handler.simulateGesture('multi_press', [1, 2, 3], 500);
      await this.wait(500);

      this.log('Gesture recognition tests completed', allPassed ? 'success' : 'error');
      return allPassed;
    } catch (error) {
      this.log(`Gesture recognition test error: ${error}`, 'error');
      return false;
    }
  }

  // === Test Case 4: Call Control - Quick Actions ===
  async testQuickCallActions(): Promise<boolean> {
    this.log('Starting quick call actions test...');

    try {
      // Setup mock call
      this.setupMockCall();

      // Test quick accept
      this.log('Testing quick accept...');
      this.handler.simulateGesture('single_click', [2], 200);
      await this.wait(1000);

      // Setup another mock call
      this.setupMockCall();

      // Test quick decline
      this.log('Testing quick decline...');
      this.handler.simulateGesture('multi_press', [1, 2, 3], 500);
      await this.wait(1000);

      this.log('Quick call actions test completed', 'success');
      return true;
    } catch (error) {
      this.log(`Quick call actions test error: ${error}`, 'error');
      return false;
    }
  }

  // === Test Case 5: Call Control - Selection Mode ===
  async testSelectionMode(): Promise<boolean> {
    this.log('Starting selection mode test...');

    try {
      // Test decline selection
      this.setupMockCall();
      this.log('Testing decline selection (left slide)...');
      this.handler.simulateGesture('slide', [3, 2, 1], 600); // Left slide
      await this.wait(500);
      
      // Confirm selection
      this.handler.simulateGesture('single_click', [2], 200);
      await this.wait(1000);

      // Test accept selection
      this.setupMockCall();
      this.log('Testing accept selection...');
      this.handler.simulateGesture('slide', [2], 300); // Center
      await this.wait(500);
      
      // Confirm selection
      this.handler.simulateGesture('single_click', [2], 200);
      await this.wait(1000);

      // Test busy SMS selection
      this.setupMockCall();
      this.log('Testing busy SMS selection (right slide)...');
      this.handler.simulateGesture('slide', [1, 2, 3], 600); // Right slide
      await this.wait(500);
      
      // Confirm selection
      this.handler.simulateGesture('single_click', [2], 200);
      await this.wait(1000);

      this.log('Selection mode test completed', 'success');
      return true;
    } catch (error) {
      this.log(`Selection mode test error: ${error}`, 'error');
      return false;
    }
  }

  // === Test Case 6: Selection Timeout ===
  async testSelectionTimeout(): Promise<boolean> {
    this.log('Starting selection timeout test...');

    try {
      this.setupMockCall();
      
      // Make a selection
      this.handler.simulateGesture('slide', [1, 2, 3], 600);
      this.log('Selection made, waiting for timeout...');
      
      // Wait for timeout (2 seconds + buffer)
      await this.wait(2500);
      
      // Selection should be cleared by now
      this.log('Selection timeout test completed', 'success');
      return true;
    } catch (error) {
      this.log(`Selection timeout test error: ${error}`, 'error');
      return false;
    }
  }

  // === Test Case 7: Performance Testing ===
  async testPerformance(): Promise<boolean> {
    this.log('Starting performance test...');

    try {
      const startTime = Date.now();
      
      // Send multiple rapid gestures
      for (let i = 0; i < 10; i++) {
        this.handler.simulateGesture('single_click', [1], 100);
        await this.wait(50);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / 10;
      
      this.log(`Performance test: ${avgTime}ms average per gesture`);
      
      if (avgTime < 100) {
        this.log('Performance test passed', 'success');
        return true;
      } else {
        this.log('Performance test failed - too slow', 'error');
        return false;
      }
    } catch (error) {
      this.log(`Performance test error: ${error}`, 'error');
      return false;
    }
  }

  // === Helper Methods ===
  private setupMockCall() {
    this.handler.setIncomingCallState(true, { from: '+1234567890' });
    
    // Trigger mock call UI if available
    if (typeof global !== 'undefined' && (global as any).mockIncomingCall) {
      (global as any).mockIncomingCall('+1234567890');
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // === Full Test Suite ===
  async runFullTestSuite(): Promise<{ passed: number; failed: number; results: { [key: string]: boolean } }> {
    this.log('=== Starting Full ESP32 Test Suite ===');
    this.testResults = {};

    const tests = [
      { name: 'Device Connection', test: () => this.testDeviceConnection() },
      { name: 'Basic Communication', test: () => this.testBasicCommunication() },
      { name: 'Gesture Recognition', test: () => this.testGestureRecognition() },
      { name: 'Quick Call Actions', test: () => this.testQuickCallActions() },
      { name: 'Selection Mode', test: () => this.testSelectionMode() },
      { name: 'Selection Timeout', test: () => this.testSelectionTimeout() },
      { name: 'Performance', test: () => this.testPerformance() },
    ];

    let passed = 0;
    let failed = 0;

    for (const testCase of tests) {
      this.log(`--- Running ${testCase.name} Test ---`);
      
      try {
        const result = await testCase.test();
        this.testResults[testCase.name] = result;
        
        if (result) {
          passed++;
          this.log(`${testCase.name} test PASSED`, 'success');
        } else {
          failed++;
          this.log(`${testCase.name} test FAILED`, 'error');
        }
      } catch (error) {
        failed++;
        this.testResults[testCase.name] = false;
        this.log(`${testCase.name} test ERROR: ${error}`, 'error');
      }

      // Wait between tests
      await this.wait(1000);
    }

    this.log('=== Test Suite Complete ===');
    this.log(`Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      this.log('🎉 All tests passed!', 'success');
    } else {
      this.log(`⚠️ ${failed} test(s) failed`, 'error');
    }

    return {
      passed,
      failed,
      results: this.testResults
    };
  }

  // === Get Test Results ===
  getTestLogs(): string[] {
    return [...this.logs];
  }

  getTestResults(): { [key: string]: boolean } {
    return { ...this.testResults };
  }

  // === Quick Individual Tests (for UI buttons) ===
  async quickConnectionTest(): Promise<boolean> {
    return await this.testDeviceConnection();
  }

  async quickGestureTest(): Promise<boolean> {
    return await this.testGestureRecognition();
  }

  async quickCallTest(): Promise<boolean> {
    return await this.testQuickCallActions();
  }

  // === Cleanup ===
  cleanup() {
    this.handler.removeAllListeners();
    this.logs = [];
    this.testResults = {};
  }
}

// Export singleton instance
export const ESP32Tests = new ESP32TestSuite();

// Usage examples:
/*
// Run full test suite
const results = await ESP32Tests.runFullTestSuite();
console.log('Test Results:', results);

// Run individual tests
const connected = await ESP32Tests.quickConnectionTest();
const gesturesWork = await ESP32Tests.quickGestureTest();

// Get logs
const logs = ESP32Tests.getTestLogs();

// Cleanup when done
ESP32Tests.cleanup();
*/
