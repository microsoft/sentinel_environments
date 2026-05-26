# Sentinel Environments

## OVERVIEW

Sentinel Environments is a benchmark dataset and accompanying code for evaluating AI agents on long-horizon monitoring tasks — a critical blind spot in current evaluations. Today's agents can browse the web, write code, and complete complex tasks through continuous sequences of actions, but ask them to patiently watch for an event over hours and they fail, or consume an unreasonable amount of resources. Sentinel Environments exposes and measures this gap through a set of high-fidelity synthetic web apps — spanning email, messaging, social media, code hosting, finance, and more — each with tasks that require agents to wait, monitor, and act over periods ranging from minutes to hours (defaulting to 10 minutes). By systematically varying task type, success criteria, and duration across 100 configurations, Sentinel Environments offers the first controlled testbed for evaluating whether agents can sustain attention, manage context, and respond reliably over extended time horizons.

### WHAT CAN SENTINEL ENVIRONMENTS DO

Sentinel Environments was developed to provide a controlled testbed for evaluating AI agents on long-horizon monitoring tasks. It consists of 10 high-fidelity web-app environment replicas (Micro\* environments), each exposing 10 objective task variants that are only possible to complete once certain environment conditions are met such as the arrival of an email, or a change in a stock price. The environments simulate real-world applications such as email clients, messaging platforms, social media feeds, code repositories, stock trackers, music players, calendars, and academic search — requiring agents to wait, monitor, and act over extended periods. In the default configuration, conditions are met within a 10 minute window, but a speed parameter can be used to reduce this to 2.5 minutes, or extend the scenario to arbitrary lengths (hours, or even days.)

Sentinel Environments Data is being released together with Sentinel Environments to enable users to run reproducible and comparable experiments across our benchmark environments with realistic synthetic content (images, videos, audio, and structured text data) without relying on real-world user data.

### INTENDED USES

Sentinel Environments is best suited for evaluating and benchmarking AI agents (Browser Use Agents and Computer Use Agents) on their ability to sustain monitoring over long durations, detect and respond to events, and manage context across extended task horizons.

Sentinel Environments Data is intended to be used together with Sentinel Environments to populate the benchmark's applications with synthetic media and structured content needed for task execution.

Sentinel Environments (code and data) are being shared with the research community to facilitate reproduction of our results and foster further research in this area.

Sentinel Environments (code and data) are intended to be used by domain experts who are independently capable of evaluating the quality of outputs before acting on them.

### OUT-OF-SCOPE USES

Sentinel Environments is not well suited for evaluating single-turn agents or tasks that do not involve temporal monitoring or waiting.

Sentinel Environments Data is not well suited for use as a general-purpose synthetic media dataset, training generative models, or any purpose unrelated to running the Sentinel Environments benchmark.

There are few or no instances of non-English content in this dataset. As a result, Sentinel Environments should not be used to evaluate an agent’s performance in multi-lingual settings.

We do not recommend using Sentinel Environments (code and data) in commercial or real-world applications without further testing and development. They are being released for research purposes.

Sentinel Environments (code and data) were not designed to evaluate all possible agentic monitoring use cases.

Without further testing and development, Sentinel Environments (code and data) should not be used to evaluate AI agents in highly regulated domains where inaccurate outputs could suggest actions that lead to injury or negatively impact an individual's legal, financial, or life opportunities.

We do not recommend using Sentinel Environments (code and data) in the context of evaluating AI agent performance related to high-risk decision making (e.g. in law enforcement, legal, finance, or healthcare).

## DATASET DETAILS

### DATASET Contents

Sentinel Environments consists of 10 rich simulated environments.

|  |  |
| --- | --- |
| **Environment Name** | **Description** |
| MicroMail | Email client with inbox, folders, filtering |
| MicroChat | Team messaging and notification |
| MicroDin | Professional network |
| MicroHub | Code repository tracking |
| MicroHood | Stock price and portfolio tracking |
| MicroGram | Social media feed and engagement metrics |
| MicroTube | Video uploads and subscriber count |
| MicroFy | Playlist updates and new releases |
| MicroLendar | Event scheduling and reminders |
| MicroScholar | Citation counts and new papers |

Sentinel Environments does not contain links to external data sources.

Each environment exposes 10 tasks, spanning three broad categories:

|  |  |
| --- | --- |
| Type | Description |
| Passive | Tasks that require little action beyond navigating to the correct web page, then passively waiting for an event to occur before notifying the user. |
| Active | Tasks that require agents to perform additional actions, above and beyond those in the passive category (e.g.. Favoriting an album once it appears in the trending list) |
| No-operation  (no-op) | Tasks that resemble passive or active, but where the event never occurs in the simulated environment. In these scenarios, the agents succeed only if they continue waiting until the moment when the simulation ends. |

All tasks are time-based, and with their trigger condition met within 600s (sampled from a uniform distribution, at the time the task was authored). A speed\_factor parameter can then be used to scale the simulation to fit other time ranges. For example, speed\_factor of 4.0 will play the simulation four times faster, resulting in each task concluding in 2.5 minutes rather than 10. Conversely, a speed\_factor parameter of 0.25 will stretch tasks out to 40 minutes rather than 10.

### DATA CREATION & PROCESSING

Sentinel Environment Data was entirely synthetically generated from scratch and includes no real users, Personally Identifiable Information (PII), or copyrighted content. Given the user’s own model endpoints, [the released pipeline](https://github.com/microsoft/sentinel_environments/tree/main/data_generation) produces synthetic media assets (images, videos, audio) to populate various mock social/productivity environments used as a benchmark for AI agents.

The synthetic media in the released dataset was generated using the following models:

* Images were generated with FLUX.2-dev
* Videos were generated with Wan2.2-T2V-14B
* Audio were generated with ACE-Step-HQ
* Text (including profiles, entities, and content) were generated using the GPT-5.x series of models

#### People & Identifiers

Sentinel Environments Data is not believed to contain information that could be used to directly and/or indirectly identify a person.

#### Sensitive or harmful content

Sentinel Environments Data is not believed to contain information that might be considered offensive or insulting, or otherwise cause emotional distress.

#### How to get started

To begin using Sentinel Environments, follow instructions in the [README](https://github.com/microsoft/sentinel_environments/).

#### Validation

To assess how effective Sentinel Environment tasks would be at its intended purpose, our team manually inspected all 100 tasks to ensure that they were well-posed. We also manually performed most tasks end-to-end to ensure they were achievable (we used a speed-factor of 3x to reduce the number of person-hours needed to manually assess each task). Finally, we ran the full benchmark end-to-end, multiple times, with multiple agents, and analyzed logs to ensure that failures were attributable to model or agent deficiencies (which is what we are intending to measure), rather than failures of the tasks or environments.

## EVALUATION

We used Sentinel Environments to measure performance differences between three models and two agent harnesses (yielding 6 combinations), to ensure that the sentinel tasks are useful for discriminating performance differences between realistic configurations. We elaborate below.

### EVALUATION METHODS

We paired three models (GPT-5.4 low thinking; GPT-4o; Qwen 3.5:9b) with Playwright and Chromium, to understand how well these existing models and tools perform in the Sentinel Environment Tasks (i.e., how well they can monitor websites for conditions to be met before acting). For each model, we consider two configurations: The first configuration provides agents with a traditional sleep( seconds ) tool, which allows agents to unconditionally pause for a specified amount of time. The second configuration provides agents with a wait\_for( condition, timeout ) tool, which allows an agent to specify a condition in natural language in natural language. When invoked, the agent then enters a hybrid loop that deterministically monitors the page for coarse structural changes (e.g., changes to the DOM), then invokes a cheaper LMM call to determine if those coarse changes meet the specified condition. Here, the sleep tool is meant to capture a baseline / status-quo, while the wait\_for tools captures a purpose-built agent harness.

We then run all 100 tasks, with all six configurations, and measure (1) if the task was completed successfully; e.g the change was eventually detected and acted upon. (2) how soon was the change detected (reaction time), and (3) how costly was the detection (both in terms of total tokens used, and number of tools invoked). We report the findings below.

### EVALUATION RESULTS

The following tables summarize our findings.

**Task success (higher is better):**

|  |  |  |  |  |
| --- | --- | --- | --- | --- |
| **Configuration** | **All Tasks** | **Passive** | **Active** | **No-op** |
| GPT-5.4, wait\_for | 0.75 | 0.92 | 0.50 | 0.95 |
| GPT-5.4, sleep | 0.68 | 0.76 | 0.60 | 0.70 |
| GPT-4o, wait\_for | 0.48 | 0.63 | 0.12 | 0.95 |
| GPT-4o, sleep | 0.46 | 0.53 | 0.14 | 1.00 |
| Qwen 3.5:9b, wait\_for | 0.48 | 0.50 | 0.24 | 0.95 |
| Qwen 3.5:9b, sleep | 0.49 | 0.39 | 0.36 | 0.95 |

From these results we observe that GPT-5.4 is the best performing model of the three tested, that passive tasks are generally easier than active tasks. Moreover, the wait\_for tool performs better on passive tasks, while sleep performs slightly better for active tasks. Almost all configurations score at, or near, perfect on no-op tasks, which are those that succeed when the agent does nothing.

**Median tokens per task (lower is better)**

|  |  |  |  |  |
| --- | --- | --- | --- | --- |
| **Configuration** | **All Tasks** | **Passive** | **Active** | **No-op** |
| GPT-5.4, wait\_for | 81,361 | 68,962 | 198,469 | 73,672 |
| GPT-5.4, sleep | 437,811 | 265,863 | 468,932 | 815,721 |
| GPT-4o, wait\_for | 50,289 | 57,768 | 49,608 | 25,105 |
| GPT-4o, sleep | 114,165 | 107,508 | 130,010 | 57,329 |
| Qwen 3.5:9b, wait\_for | 236,458 | 106,877 | 320,276 | 464,389 |
| Qwen 3.5:9b, sleep | 352,281 | 206,166 | 352,281 | 754,293 |

From these results, we observe that the wait\_for tool consumes many fewer tokens than the sleep tool.

Together, these tables show that Sentinel Environments and Tasks can be used to measure meaningful differences in both the proficiency and efficiency of different models and agents. This is precisely Sentinel Environments and Tasks were designed to achieve, and so we conclude that this release is fit-for-purpose.

## LIMITATIONS

Sentinel Environments (code and data) were developed for research and experimental purposes to evaluate AI model performance on long-running monitoring tasks. Performance on this synthetic dataset may not generalize to real-world applications. Further testing and validation are needed before considering the use of Sentinel Environments in commercial or real-world scenarios.

Sentinel Environments (code and data) were designed and tested using the English language. There are few instances of non-English in the dataset. As a result, Sentinel Environments data should not be used for evaluating agent performance across languages, cultures, or accessibility scenarios.

Any datasets generated using the Sentinel Environments pipeline may inherit any biases, errors, or omissions produced by the models used. Developers are advised to choose an appropriate base LLM/MLLM carefully, depending on the intended use case.

Sentinel Environments data contains AI-generated images, videos, and audio that may exhibit visual artifacts, unrealistic details, temporal inconsistencies, or other imperfections characteristic of current generative models (FLUX.2-dev, Wan2.2-T2V-14B, ACE-Step).

Sentinel Environments Data has not been systematically evaluated for sociocultural/economic/demographic/linguistic bias. Developers should consider the potential for bias as they select use cases, and evaluate and mitigate for accuracy, safety, and fairness concerns specific to each intended downstream use.

There has not been a systematic effort to ensure that systems using Sentinel Environments are protected from security vulnerabilities such as indirect prompt injection attacks. Any systems using it should take proactive measures to harden their systems as appropriate.

## BEST PRACTICES

We recommend running Sentinel Environments as a single monolithic benchmark rather than running multiple tasks in parallel. This ensures there are no conflicts with ports or server states. If parallelizing execution, we recommend dividing tasks by application and running each application in a separate container or machine (e.g., all micromail tasks on one machine, and microhub tasks on another).

## LICENSE

MIT License

Nothing disclosed here, including the Out of Scope Uses section, should be interpreted as or deemed a restriction or modification to the license the code is released under.

## TRADEMARKS

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft trademarks or logos is subject to and must follow Microsoft's Trademark & Brand Guidelines. Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship. Any use of third-party trademarks or logos are subject to those third-party's policies.

## CONTACT

This research was conducted by members of [Microsoft Research](https://www.microsoft.com/en-us/research/). We welcome feedback and collaboration from our audience. If you have suggestions, questions, or observe unexpected/offensive behavior in our technology, please contact us at adamfo@microsoft.com

If the team receives reports of undesired behavior/content or identifies issues independently, we will update this repository with appropriate mitigations.
