# GitHub repository description and topics

Suggested description:

> A 3D survival game in your browser. Guide a destructible cube through rotating laser corridors as time, entropy and heat close in. Web port of Cube Libre.

The repository's discoverability tags are called **topics**. They are separate
from release tags such as `v0.21.0`. This package does not change GitHub settings
on its own. Run this once with your authenticated GitHub CLI to set the
description, live-game homepage and topics:

```bash
gh repo edit FlyingFathead/cube-libre \
  --description 'A 3D survival game in your browser. Guide a destructible cube through rotating laser corridors as time, entropy and heat close in. Web port of Cube Libre.' \
  --homepage 'https://flyingfathead.github.io/cube-libre/' \
  --add-topic browser-game \
  --add-topic web-game \
  --add-topic javascript \
  --add-topic webgl \
  --add-topic threejs \
  --add-topic github-pages \
  --add-topic indie-game \
  --add-topic survival-game \
  --add-topic procedural-generation \
  --add-topic pygame
```

The command adds these topics alongside existing ones. It does not publish a
release. See the [GitHub CLI reference](https://cli.github.com/manual/gh_repo_edit)
for these repository settings.
