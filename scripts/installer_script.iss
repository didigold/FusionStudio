#ifndef AppVersion
  #define AppVersion "1.0"
#endif

[Setup]
AppId={{928AD631-4FEF-407E-971D-3A252E9B5690}}
AppName=FusionStudio Pro
AppVersion={#AppVersion}
DefaultDirName={autopf}\FusionStudio_Pro
DefaultGroupName=FusionStudio Pro
UninstallDisplayIcon={app}\FusionStudio_Pro.exe
OutputDir=..\dist
OutputBaseFilename=FusionStudio_Pro_Setup
SetupIconFile=..\backend\assets\icon.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern

; "lowest" means it runs in the context of the user, no admin/UAC prompt
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; Gracefully shut down the application if it's currently running during an upgrade
CloseApplications=yes
CloseApplicationsFilter=*


[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\dist\FusionStudio_Pro\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\FusionStudio Pro"; Filename: "{app}\FusionStudio_Pro.exe"
Name: "{autodesktop}\FusionStudio Pro"; Filename: "{app}\FusionStudio_Pro.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\FusionStudio_Pro.exe"; Description: "{cm:LaunchProgram,FusionStudio Pro}"; Flags: nowait postinstall skipifsilent
