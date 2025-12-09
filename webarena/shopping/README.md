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

This will run the docker container in a loop, waiting until the container exits. If the container exits, it automatically restarts the container. This is meant to be used in tandem with the evaluation harness which resets the environment between scenario runs by stopping the container. 
```
bash run_server.bash 
```

#### Connecting to the shopping website 
You can now connect to the shopping website in a browser, either at http://localhost:7770, or use the hostname of the GCR machine (if applicable).


#### Connecting to the Sentinel server manually 
You can connect and interact with the server, at http://localhost:8000, or use the hostname of the GCR machine. 

To check the status of the simulation: 
http://localhost:8000/status

To advance to the next event at time `t` in the simulation: 
http://localhost:8000/advance?t=<time_in_seconds>

To autoplay all the events in the simulation: 
http://localhost:8000/play

To close the simulation: 
http://localhost:8000/close 


#### To be added to this README
- How to generate new events for the simulation (using generate_events.py)