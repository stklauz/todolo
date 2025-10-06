# User interaction description

this document's purpose is to document the type of experience and interaction users should have in the app. the main purpose of this document is to make sure that every time we write new code, or create new tests, we can look at the expected outcomes and address them accordingly.

## About the app

Todolo is a todo app built to be as simple as possible for users to use. Our principles come from managing todos on text editors, and this app is just a gateway to be able to have that kind of freedom with a better, built for that purpose experience.

## How it works

Todolo's setup is as simple as possible. Users install the app, and once they open it for the first time, they see the app with a list (selected), and an input to add a new todo.

Lists:
- Lists can be created. Users can have as many lists as they want. 
- Users can change their title (via rename).
- Lists can be deleted. We allow users to delete any lists, until there is only one left. It's impossible not to have at least ONE list on the app.

Todos:
- Todos are part of a list. A list is a set of todos + title, basically.
- Todos are broken down in two sections: active todos and complete todos.
- There must always be a todo in a list, even if that todo is empty.
- If a todo is empty, it's checkbox should be disabled.
- Each todo contains a checkbox, checking that checkbox will send the todo to the completed todos section (except if the todo's indentation is over 0)
- Todos can be dragged and sorted within their sections.
- Todos can be edited any time, and should be saved
- Managing todos is mostly done with the keyboard

Keyboard
- To input a todo, the todo should have a value and the user should press enter
- Pressing enter on an empty todo should not have any action
- Pressing enter on a todo with a value should enter a new line
- To delete a todo, the use should delete the todo's value, and press backspace. Doing so will focus the mouse on the previous todo
- If a todo is the only todo left and its empty, and backspace is pressed, nothing should happen. There must always be a todo in a list.
- Pressing tab should increase the indentation of the todos, while pressing shift+tab should reduce the indentation of the todos. 

App:
- Closing the app and opening it again should bring your latest changes, so you dont lose any work. That means each time a todo or list is added, edited or deleted, each action should be saved.
- The app has settings, such as displaying / hidding completed items.

Rename mode
- When starting a list rename (e.g., after creating a list), the title input gains focus and todo inputs do not automatically steal focus. Keyboard interactions that would normally move focus between todos (like inserting a new line) should not override the title editing focus until rename completes or is cancelled.
