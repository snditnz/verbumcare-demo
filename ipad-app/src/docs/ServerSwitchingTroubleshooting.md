# Server Switching Troubleshooting Guide

## Quick Diagnostic Checklist

Before diving into specific issues, run through this quick checklist:

- [ ] Check network connectivity (WiFi signal strength)
- [ ] Verify current server status in Settings
- [ ] Run connection test on target server
- [ ] Check for any error messages or alerts
- [ ] Note the time and circumstances of the issue

## Common Issues and Solutions

### 1. Server Switch Fails to Complete

**Symptoms:**
- Switch process starts but never completes
- App shows "Switching" status indefinitely
- No error message displayed

**Immediate Actions:**
1. Wait 60 seconds for timeout
2. Force close and restart the app
3. Check network connectivity
4. Try switching to the other server

**Detailed Solutions:**
- **Network Issues**: Verify WiFi connection is stable and has internet access
- **Server Overload**: Target server may be under heavy load, try again in a few minutes
- **Authentication Problems**: Restart app to refresh authentication tokens
- **Cache Issues**: Clear app cache through device settings

**Prevention:**
- Always run connection test before switching
- Avoid switching during peak usage hours
- Ensure stable network before initiating switch

### 2. Connection Test Fails

**Symptoms:**
- Test button shows failure result
- Timeout errors during testing
- Partial health check failures

**Diagnostic Steps:**
1. Check which specific health checks are failing
2. Verify network connectivity to server
3. Test from different network if possible
4. Check server status with IT team

**Solutions by Health Check:**
- **/health endpoint fails**: Server may be down or restarting
- **/api/patients fails**: Database connectivity issues
- **/api/auth/login fails**: Authentication service problems
- **Multiple endpoints fail**: Network or server-wide issues

**When to Escalate:**
- All health checks fail consistently
- Other users report similar issues
- Server was working previously

### 3. Authentication Errors After Switch

**Symptoms:**
- Login screen appears after switch
- "Invalid credentials" errors
- Session expired messages

**Immediate Solutions:**
1. Re-enter username and password
2. Restart the application
3. Clear app data and re-login
4. Verify credentials with administrator

**Root Causes:**
- **Server-Specific Accounts**: Some servers may have different user databases
- **Session Timeout**: Authentication tokens may not transfer between servers
- **Account Lockout**: Multiple failed attempts may lock account
- **Server Configuration**: Authentication settings may differ between servers

**Long-term Solutions:**
- Implement single sign-on (SSO) across servers
- Synchronize user databases between servers
- Configure session token sharing

### 4. Data Synchronization Problems

**Symptoms:**
- Missing patient data after switch
- Outdated information displayed
- Sync conflicts or errors

**Immediate Actions:**
1. Pull down to refresh patient list
2. Check offline queue status
3. Process pending offline operations
4. Verify network connectivity

**Data Recovery Steps:**
1. **Check Offline Queue**: Settings → Debug → View offline operations
2. **Force Sync**: Use pull-to-refresh on main screens
3. **Manual Sync**: Process offline queue manually
4. **Cache Refresh**: Clear and reload patient cache

**Prevention:**
- Process offline queue before switching
- Ensure stable network during switch
- Verify data sync after switch completion

### 5. Performance Issues After Switch

**Symptoms:**
- Slow response times
- Timeouts on operations
- Poor voice processing performance

**Performance Diagnostics:**
1. Check connection status and response times
2. Compare performance between servers
3. Monitor network quality indicators
4. Test different operations (voice, data entry, etc.)

**Optimization Steps:**
- **Network Optimization**: Use 5GHz WiFi when available
- **Server Selection**: Switch to higher-performance server
- **Cache Management**: Clear cache to reduce memory usage
- **Background Apps**: Close unnecessary apps to free resources

### 6. Voice Processing Failures

**Symptoms:**
- Voice recordings fail to process
- Transcription errors or timeouts
- AI extraction not working

**Specific Checks:**
1. Verify AI services are running on target server
2. Test voice recording and playback
3. Check processing queue status
4. Verify network bandwidth for uploads

**Server-Specific Solutions:**
- **Mac Mini**: Verify Ollama and Whisper services are running
- **pn51**: Check legacy AI service configuration
- **Both**: Ensure sufficient server resources for AI processing

### 7. SSL Certificate Errors

**Symptoms:**
- Certificate warnings or errors
- "Untrusted connection" messages
- HTTPS connection failures

**Security Verification:**
1. Check certificate validity dates
2. Verify certificate matches server hostname
3. Confirm certificate authority is trusted
4. Report certificate issues to IT immediately

**Temporary Workarounds:**
- Use alternate server if certificates are valid
- Contact IT for certificate renewal
- Document certificate errors for security team

**Never:**
- Ignore certificate warnings
- Bypass SSL verification
- Continue with untrusted connections

## Advanced Troubleshooting

### Debug Log Analysis

**Accessing Logs:**
1. Go to Settings → Debug & Troubleshooting
2. Tap "View Debug Logs"
3. Look for server switching related entries
4. Export logs for technical support

**Key Log Patterns:**
- `ServerSwitch: Starting switch to [server]`
- `ConnectionTest: Testing [endpoint]`
- `AuthError: Authentication failed`
- `NetworkError: Connection timeout`

### Network Diagnostics

**Tools and Tests:**
1. **Ping Test**: Verify basic connectivity to server
2. **Speed Test**: Check bandwidth and latency
3. **DNS Resolution**: Ensure server hostnames resolve correctly
4. **Port Connectivity**: Verify HTTPS (443) access

**Network Requirements:**
- Minimum 1 Mbps upload for voice processing
- Latency under 500ms for responsive operation
- Stable connection without frequent drops
- DNS resolution for server hostnames

### Server Health Monitoring

**Health Check Endpoints:**
- `/health`: Basic server status
- `/api/patients`: Database connectivity
- `/api/auth/login`: Authentication service
- Custom endpoints per server configuration

**Response Time Benchmarks:**
- **Excellent**: < 100ms
- **Good**: 100-300ms
- **Acceptable**: 300-1000ms
- **Poor**: > 1000ms (investigate)

## Escalation Procedures

### When to Contact IT Support

**Immediate Escalation:**
- Security certificate errors
- Data loss or corruption
- Multiple users affected
- Server completely unavailable

**Scheduled Escalation:**
- Persistent performance issues
- Recurring connection problems
- Authentication configuration needs
- Server capacity planning

### Information to Provide

**Technical Details:**
- Device model and iOS version
- App version and build number
- Server names and endpoints
- Exact error messages
- Steps to reproduce issue

**Context Information:**
- Time and date of issue
- Network environment (WiFi, cellular)
- Number of users affected
- Business impact assessment
- Workarounds attempted

### Emergency Procedures

**Server Outage Response:**
1. Switch to backup server immediately
2. Notify all users of the switch
3. Document outage time and impact
4. Monitor backup server performance
5. Plan return to primary server

**Data Recovery Process:**
1. Stop all operations immediately
2. Export debug logs and offline queue
3. Contact technical support
4. Do not attempt manual data recovery
5. Wait for professional assistance

## Prevention and Best Practices

### Regular Maintenance

**Weekly Tasks:**
- Test connection to backup server
- Review and process offline queue
- Check for app updates
- Verify server health status

**Monthly Tasks:**
- Review server performance metrics
- Update troubleshooting documentation
- Train new users on server switching
- Conduct failover testing

### User Training

**Essential Skills:**
- How to check connection status
- When and how to switch servers
- Basic troubleshooting steps
- When to escalate issues

**Training Resources:**
- In-app help system
- User guide documentation
- Hands-on practice sessions
- Regular refresher training

### System Monitoring

**Key Metrics:**
- Server response times
- Connection success rates
- Authentication failure rates
- Data synchronization status

**Alerting Thresholds:**
- Response time > 1 second
- Connection failure rate > 5%
- Authentication failures > 10%
- Sync delays > 5 minutes

---

*For additional support, contact your facility's IT department or use the in-app debug log export feature to provide detailed technical information.*