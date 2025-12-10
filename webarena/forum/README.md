# WebArena Forum Environment (aka 'Reddit', aka 'Postmill')

### Download and load the latest image:

```bash
wget http://metis.lti.cs.cmu.edu/webarena-images/postmill-populated-exposed-withimg.tar
docker load < postmill-populated-exposed-withimg.tar
```

Locally-hosted copies of the image are also available [here](https://microsoft-my.sharepoint.com/:f:/p/adamfo/IgBrTH551q7cRZOEdsoBCL_XASH4WMxp4DAymXZbu0McIBg?e=btI5cE).

#### Build and Run the Sentinel Image:

```
cd docker_env
bash rebuild.bash start 
```

You can now connect to the forum in a browser, either at http://localhost:9999, or use the hostname of the GCR machine (if applicable).

Likewise, you can also interact with the Sentinel API on port 8000. E.g.,

http://localhost:8000/status
