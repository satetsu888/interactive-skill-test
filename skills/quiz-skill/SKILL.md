---
name: quiz
description: A skill that presents multiple-choice quizzes in a browser UI with immediate feedback, explanations, and score tracking.
---

## Overview

This skill launches a browser-based quiz interface. Questions are presented one at a time with multiple choices. After answering, the user sees whether they were correct and can read an explanation. At the end, a results screen shows the score and allows reviewing each question.

## Usage

1. Prepare the data as JSON:
   ```json
   {
     "title": "Quiz Title",
     "description": "Optional description",
     "questions": [
       {
         "id": "1",
         "question": "What is the question?",
         "choices": [
           { "label": "A", "text": "First option" },
           { "label": "B", "text": "Second option" },
           { "label": "C", "text": "Third option" },
           { "label": "D", "text": "Fourth option" }
         ],
         "answer": "B",
         "explanation": "Explanation of why B is correct."
       }
     ]
   }
   ```
   - `choices`: Array of options. `label` is the identifier (A/B/C/D), `text` is the display text.
   - `answer`: The `label` of the correct choice.
   - `explanation`: Shown after the user answers.

2. Run the following command **in the background**:
   ```bash
   node skills/quiz-skill/server.mjs --port 5190 --data '<JSON data>'
   ```

3. Open the URL in the user's browser:
   ```bash
   open http://localhost:5190
   ```

4. The output is a JSON object with the quiz results:
   ```json
   {
     "action": "submit",
     "payload": {
       "score": 3,
       "total": 5,
       "percentage": 60,
       "details": [
         {
           "questionId": "1",
           "question": "What is the question?",
           "selected": "A",
           "correct": false,
           "correctAnswer": "B"
         }
       ]
     }
   }
   ```

## Example use cases

- Knowledge check after a learning session
- Code review quiz (what does this code do?)
- Onboarding quiz for new team members
- Retrospective / session recap quiz
