# VerbumCare Server Switching User Guide

## Overview

VerbumCare supports switching between multiple backend servers to ensure continuous operation during maintenance, upgrades, or system failures. This guide provides comprehensive instructions for safely switching servers and troubleshooting common issues.

## Available Servers

### Mac Mini (Production Server)
- **Purpose**: Primary production server for daily operations
- **Features**: 
  - Apple Silicon Metal GPU acceleration
  - Offline AI processing capabilities
  - High-speed voice recognition
  - Auto-start configuration for reliability
- **Recommended Use**: Default server for all normal operations
- **Performance**: Optimized for Apple Silicon hardware

### pn51 Legacy Server
- **Purpose**: Backup server for rollback and emergency situations
- **Features**:
  - Proven stability and reliability
  - Full feature compatibility
  - Emergency response capabilities
  - Rollback support
- **Recommended Use**: Emergency fallback when Mac Mini is unavailable
- **Performance**: Stable baseline performance

## How to Switch Servers

### Step 1: Prepare for Switch
1. **Save Current Work**: Complete any ongoing tasks and save your progress
2. **Check Network**: Ensure stable network connectivity
3. **Notify Team**: Inform other users if switching affects shared resources

### Step 2: Test Target Server
1. Navigate to **Settings** → **Server Configuration**
2. Find the target server in the **Available Servers** list
3. Tap the **Test** button next to the server name
4. Wait for connection test results
5. Verify all health checks pass before proceeding

### Step 3: Perform Switch
1. Tap on the target server card
2. Confirm the switch when prompted (if confirmation is enabled)
3. Wait for the switching process to complete
4. Verify successful connection to the new server

### Step 4: Verify Operation
1. Check the connection status indicator
2. Test basic functionality (patient list, voice recording, etc.)
3. Verify data synchronization is working
4. Report any issues immediately

## Connection Status Indicators

| Status | Icon | Meaning | Action Required |
|--------|------|---------|----------------|
| **Connected** | ✅ Green circle | Normal operation | None |
| **Disconnected** | ❌ Red circle | No server connection | Check network, switch servers |
| **Testing** | ⏱️ Clock | Running connection test | Wait for completion |
| **Switching** | 🔄 Arrows | Server switch in progress | Wait, do not interrupt |
| **Error** | ⚠️ Warning | Connection problem | Check logs, contact support |

## Troubleshooting Common Issues

### Connection Failed
**Symptoms**: Cannot connect to server, timeout errors
**Solutions**:
1. Check your network connection and WiFi signal
2. Try switching to the other available server
3. Restart the VerbumCare application
4. Check debug logs for detailed error information
5. Contact IT support if issues persist

### Slow Response Times
**Symptoms**: Long delays, timeouts, poor performance
**Solutions**:
1. Check network quality and bandwidth
2. Verify server load status with IT team
3. Run connection tests to measure response times
4. Consider switching to alternate server temporarily
5. Report performance issues to system administrator

### Authentication Errors
**Symptoms**: Login failures, credential rejection
**Solutions**:
1. Verify username and password are correct
2. Check if account is locked or expired
3. Restart the application to refresh authentication
4. Contact server administrator for account issues
5. Verify server-specific authentication requirements

### Data Synchronization Issues
**Symptoms**: Missing data, sync conflicts, outdated information
**Solutions**:
1. Force refresh by pulling down on patient list
2. Check offline queue for pending operations
3. Verify network connectivity is stable
4. Process offline queue manually if needed
5. Contact support for data recovery assistance

## Best Practices

### Regular Operations
- Use Mac Mini as primary server for daily operations
- Monitor connection status regularly
- Test alternate server connectivity weekly
- Keep offline queue processed and minimal

### Maintenance Windows
- Switch to backup server before scheduled maintenance
- Verify backup server functionality before maintenance begins
- Communicate maintenance schedule to all users
- Switch back after maintenance completion and verification

### Emergency Situations
- Switch immediately if primary server becomes unavailable
- Document the issue and time of switch
- Notify IT support and management
- Monitor backup server performance closely
- Plan return to primary server when available

### Performance Optimization
- Use connection tests to verify server health
- Monitor response times and report degradation
- Keep application updated for optimal compatibility
- Clear cache if experiencing performance issues

## Security Considerations

### Network Security
- All server connections use HTTPS encryption
- Verify SSL certificates are valid and trusted
- Report any certificate warnings immediately
- Use secure network connections only

### Data Protection
- Patient data is encrypted in transit and at rest
- Server switches preserve data integrity
- Audit logs track all server changes
- Backup procedures protect against data loss

### Access Control
- Only authorized users can switch servers
- Server switching actions are logged and auditable
- Administrative privileges required for server configuration
- Regular access reviews ensure appropriate permissions

## Getting Help

### In-App Support
- Access help through Settings → Help button
- View debug logs for technical information
- Export logs for technical support
- Use connection tests for diagnostics

### Contact Information
- **IT Support**: Contact your facility's IT department
- **Technical Issues**: Use debug log export feature
- **Training**: Request additional training from administrators
- **Emergency**: Follow facility emergency procedures

### Documentation
- This guide: Comprehensive server switching instructions
- API Documentation: Technical integration details
- Troubleshooting Guide: Detailed problem resolution
- Release Notes: Latest feature updates and changes

## Frequently Asked Questions

**Q: How long does server switching take?**
A: Typically 10-30 seconds depending on network conditions and server load.

**Q: Will I lose data when switching servers?**
A: No, all data is preserved. The app maintains offline capabilities during switches.

**Q: Can I switch servers while recording voice notes?**
A: It's recommended to complete voice recordings before switching servers.

**Q: How do I know which server is currently active?**
A: Check the connection status in Settings or the server indicator on main screens.

**Q: What happens if both servers are unavailable?**
A: The app continues to work offline. Data will sync when servers become available.

**Q: Can multiple users switch servers simultaneously?**
A: Yes, server switching is per-device and doesn't affect other users.

---

*This guide is updated regularly. For the latest version, check the in-app help system or contact your system administrator.*