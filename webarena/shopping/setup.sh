# A script to setup a GCR instance for hosting the shopping environment. 
# This is meant to be run on a fresh Ubuntu instance, and will install all necessary dependencies, clone the sentinel repo, and download the shopping environment image.


NAME="<your GH name here>"
EMAIL="<your GH email here>"

# apt 
sudo apt update
sudo apt install -y git curl unzip python3 python3-dev
sudo apt install python3.12-venv

# Sometimes default editor is set to Nano, so we set it to Vim
echo 'export EDITOR='vim'' >> ~/.bashrc
echo 'export VISUAL='vim'' >> ~/.bashrc

# SSH KEy setup, Probably need to make this more automated
ssh-keygen -t ed25519 -C "$EMAIL"
cat ~/.ssh/id_ed25519.pub # Needs copied into GitHub

echo "Copy the above into your GH keys in Settings.  Then press enter to continue..."
read

# Configure GIT identities
git config --global user.email "$EMAIL"
git config --global user.name "$NAME"


# Install UV
curl -Ls https://astral.sh/uv/install.sh | bash
exec $SHELL 
uv sync 

# Clone sentinel repo 
git clone git@github.com:microsoft/sentinel_environments.git

# Download shopping environment 
curl http://metis.lti.cs.cmu.edu/webarena-images/shopping_final_0712.tar --output shopping_final_0712.tar

docker load < shopping_final_0712.tar

# Rebuild webarena image to ensure compatibility with local setup
cd sentinel_environments/webarena/shopping/docker_env
bash rebuild.bash

# Do these commands manually after the above completes. 
# Run container in tmux
# tmux 
# cd ../
# bash run_server.bash
