property serverPID : ""

on run
	set appPath to POSIX path of (path to me)
	if appPath ends with "/" then set appPath to text 1 thru -2 of appPath
	set projectPath to do shell script "/usr/bin/dirname " & quoted form of appPath
	
	set homePath to POSIX path of (path to home folder)
	set pythonCandidates to {projectPath & "/.venv/bin/python3", homePath & "miniconda3/bin/python3", homePath & "anaconda3/bin/python3", "/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"}
	set pythonPath to missing value
	repeat with candidate in pythonCandidates
		try
			do shell script quoted form of (candidate as text) & " -c " & quoted form of "import sys; assert sys.version_info >= (3, 10)"
			set pythonPath to candidate as text
			exit repeat
		end try
	end repeat
	
	if pythonPath is missing value then
		display alert "PKUscore 启动失败" message "没有找到 Python 3。请先安装 Python 3.10 或更高版本。" as critical
		quit
		return
	end if
	
	set existingPort to ""
	set selectedPort to missing value
	repeat with candidatePort from 8000 to 8099
		try
			do shell script "/usr/bin/nc -z 127.0.0.1 " & candidatePort
			try
				do shell script "/usr/bin/curl --max-time 1 -fsS http://127.0.0.1:" & candidatePort & "/ | /usr/bin/grep -q '<title>PKUscore'"
				set existingPort to candidatePort as text
				exit repeat
			end try
		on error
			set selectedPort to candidatePort
			exit repeat
		end try
	end repeat
	
	if existingPort is not "" then
		open location "http://127.0.0.1:" & existingPort & "/"
		quit
		return
	end if
	
	if selectedPort is missing value then
		display alert "PKUscore 启动失败" message "8000–8099 端口均已被占用。" as critical
		quit
		return
	end if
	
	set launchCommand to "cd " & quoted form of projectPath & "; /usr/bin/nohup " & quoted form of pythonPath & " app.py --port " & selectedPort & " >/tmp/pkuscore-launch.log 2>&1 </dev/null & /bin/echo $!"
	try
		set serverPID to do shell script launchCommand
	on error
		display alert "PKUscore 启动失败" message "无法启动本地服务，请查看项目中的 README.md。" as critical
		quit
		return
	end try
	
	set isReady to false
	repeat 80 times
		try
			do shell script "/usr/bin/curl --max-time 1 -fsS http://127.0.0.1:" & selectedPort & "/ >/dev/null"
			set isReady to true
			exit repeat
		on error
			delay 0.1
		end try
	end repeat
	
	if isReady then
		open location "http://127.0.0.1:" & selectedPort & "/"
	else
		display alert "PKUscore 启动失败" message "本地服务未能及时就绪，请查看 /tmp/pkuscore-launch.log。" as critical
		quit
	end if
end run

on idle
	return 60
end idle

on quit
	if serverPID is not "" then
		try
			do shell script "/bin/kill " & serverPID
		end try
	end if
	continue quit
end quit
