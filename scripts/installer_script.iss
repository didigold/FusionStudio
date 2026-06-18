#ifndef AppVersion
  #define AppVersion "1.0"
#endif

[Setup]
AppId={{928AD631-4FEF-407E-971D-3A252E9B5690}}
AppName=FusionStudio
AppVersion={#AppVersion}
DefaultDirName={autopf}\FusionStudio
DefaultGroupName=FusionStudio
UninstallDisplayIcon={app}\FusionStudio.exe
OutputDir=..\dist
OutputBaseFilename=FusionStudio_Setup
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
Source: "..\dist\FusionStudio\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\FusionStudio"; Filename: "{app}\FusionStudio.exe"
Name: "{autodesktop}\FusionStudio"; Filename: "{app}\FusionStudio.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\FusionStudio.exe"; Description: "{cm:LaunchProgram,FusionStudio}"; Flags: nowait postinstall skipifsilent
