# WebArena Shopping Environment (aka 'OneStopShop')

### Download and load the latest image:

```bash
wget http://metis.lti.cs.cmu.edu/webarena-images/shopping_final_0712.tar
docker load < shopping_final_0712.tar
```

Locally-hosted copies of the image are also available [here](https://microsoft-my.sharepoint.com/:f:/p/adamfo/IgBrTH551q7cRZOEdsoBCL_XASH4WMxp4DAymXZbu0McIBg?e=btI5cE).

#### Build and Run the Sentinel Image:

```
cd docker_env
bash rebuild.bash start 
```

#### Run the Sentinel image in a loop

This will run the docker container in a loop, waiting until the container exits. If the container exits, it automatically restarts the container. This is meant to be used in tandem with the evaluation harness which resets the environment between scenario runs by stopping the contaier. 
```
bash run_server.bash 
```


You can now connect to the shopping website in a browser, either at http://localhost:7770, or use the hostname of the GCR machine (if applicable).
