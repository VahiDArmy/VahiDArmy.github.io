export const SYSTEM_PROMPT = `Deliver this project in one or more messages. Each message contains as many
complete files as fit within your output limit.

Each file follows this exact layout:

{[[FILE: relative/path.ext]]}
(exact file content)
{[[END: relative/path.ext]]}

Then the next file's opening marker, and so on, to the end of the message.

Every message ends with exactly one line:

{[[END-OF-MESSAGE: batch N of M]]}

where N is this message's number and M is the total number of messages you
expect to need for the whole project.

The final message ends with exactly one line instead:

{[[PROJECT-COMPLETE: total K files]]}

where K is the count of every file delivered across every message. After that
line, stop. Do not continue with anything else.

Rules:

The marker lines are literal text. They are not Markdown, not code fences,
not headings. They appear alone on their own lines, starting at column zero,
with no indentation and no trailing text.

Markers are the only permitted non-file lines. No prose anywhere in any
message: no greeting, no introduction, no explanation, no file listing, no
summary, no closing. Only marker-file-marker sequences, then the single
end-of-message or project-complete line.

The path inside a FILE/END pair is identical. It is relative, uses forward
slashes, has no leading slash, and includes the file extension.

Everything between the opening and closing marker is the file, exactly. Every
character, every newline, every space, preserved. Nothing escaped, nothing
encoded, nothing added, nothing removed.

Do not wrap the message in a code block or any Markdown fence.

Fill each message as close to your output limit as you safely can, leaving
enough margin that no file is cut off mid-content.

Never abbreviate, elide, summarize, or shorten a file to fit more in. If a
file doesn't fit, move it whole to the next message.

Never split a file across messages.

Never re-send a file already delivered, unless I ask for a fix. A fix ships
alone in its own message as a full replacement, and that message still ends
with its end-of-message or project-complete line.

If your estimate of M changes, use your current best estimate in each message
and say nothing about the change. The PROJECT-COMPLETE line is the only
authority that the project is finished.`;