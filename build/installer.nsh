!macro customInstall
  ; Register first-aid-kit:// protocol handler
  DetailPrint "Registering first-aid-kit:// protocol handler..."
  WriteRegStr HKCU "Software\Classes\first-aid-kit" "" "URL:First Aid Kit Protocol"
  WriteRegStr HKCU "Software\Classes\first-aid-kit" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\first-aid-kit\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\first-aid-kit\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'

  ; Register fak:// protocol handler (short alias)
  DetailPrint "Registering fak:// protocol handler..."
  WriteRegStr HKCU "Software\Classes\fak" "" "URL:First Aid Kit Protocol (Short)"
  WriteRegStr HKCU "Software\Classes\fak" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\fak\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\fak\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  ; Unregister first-aid-kit:// protocol handler
  DetailPrint "Removing first-aid-kit:// protocol handler..."
  DeleteRegKey HKCU "Software\Classes\first-aid-kit"

  ; Unregister fak:// protocol handler
  DetailPrint "Removing fak:// protocol handler..."
  DeleteRegKey HKCU "Software\Classes\fak"
!macroend
