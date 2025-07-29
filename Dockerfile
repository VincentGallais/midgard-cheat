FROM public.ecr.aws/ubuntu/ubuntu:25.04_stable

# Install the required tools and libraries
RUN apt-get clean && apt-get update && apt-get install --no-install-recommends -y \
    build-essential \
    ca-certificates \
    curl \
    dumb-init \
    git \
    && apt-get autoremove && apt-get autoclean

# Node.js environment
ENV NODE_VERSION=24.3.0 \
    NVM_DIR=/usr/local/nvm

RUN mkdir -p $NVM_DIR \
    && curl --silent -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

ENV NODE_PATH=$NVM_DIR/v$NODE_VERSION/lib/node_modules \
    PATH=$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# Project
WORKDIR /midgard

# Get the git info
COPY ./.git /.git
RUN touch git-info.txt \
    && git log -1 --pretty=format:"%h" >> git-info.txt \
    && echo "\n" >> git-info.txt \
    && git tag --sort=-creatordate --merged | head -n 1 >> git-info.txt

# Build the server
COPY . /midgard
RUN npm i --omit=dev \
    && npm cache clean --force

# Run the server
EXPOSE 8080
CMD ["/bin/bash", "-c", "dumb-init node /midgard/server.js"]
