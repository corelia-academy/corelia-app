use std::{fs, io, path::Path};

#[derive(Debug, Clone, PartialEq)]
pub struct Task {
    pub id: u64,
    pub title: String,
    pub done: bool,
}

pub fn is_valid_title(title: &str) -> bool {
    !title.trim().is_empty() && !title.contains(['\n', '\r', '\t'])
}

pub fn add_task(tasks: &mut Vec<Task>, title: &str) -> Result<u64, String> {
    if !is_valid_title(title) {
        return Err("Title must be non-empty and contain no tabs or newlines".into());
    }
    let id = tasks.iter().map(|task| task.id).max().unwrap_or(0)
        .checked_add(1).ok_or("Task ID overflow")?;
    tasks.push(Task { id, title: title.trim().to_owned(), done: false });
    Ok(id)
}

pub fn complete_task(tasks: &mut [Task], id: u64) -> Result<(), String> {
    let task = tasks.iter_mut().find(|task| task.id == id).ok_or("Task not found")?;
    task.done = true;
    Ok(())
}

pub fn parse_tasks(input: &str) -> Result<Vec<Task>, String> {
    let mut tasks: Vec<Task> = Vec::new();
    for (line_number, line) in input.lines().enumerate() {
        let fields: Vec<&str> = line.splitn(3, '\t').collect();
        if fields.len() != 3 || !is_valid_title(fields[2]) {
            return Err(format!("Invalid task at line {}", line_number + 1));
        }
        let id = fields[0].parse::<u64>().map_err(|_| "Invalid task ID")?;
        if id == 0 || tasks.iter().any(|task| task.id == id) {
            return Err("Duplicate or zero task ID".into());
        }
        let done = match fields[1] { "0" => false, "1" => true, _ => return Err("Invalid task status".into()) };
        tasks.push(Task { id, title: fields[2].to_owned(), done });
    }
    Ok(tasks)
}

pub fn serialize_tasks(tasks: &[Task]) -> String {
    tasks.iter().map(|task| format!("{}\t{}\t{}\n", task.id, u8::from(task.done), task.title)).collect()
}

pub fn load_tasks(path: &Path) -> Result<Vec<Task>, String> {
    match fs::read_to_string(path) {
        Ok(input) => parse_tasks(&input),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(error.to_string()),
    }
}

pub fn save_tasks(path: &Path, tasks: &[Task]) -> Result<(), String> {
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, serialize_tasks(tasks)).map_err(|error| error.to_string())?;
    fs::rename(&temporary, path).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn adds_and_completes_tasks() {
        let mut tasks = Vec::new();
        assert_eq!(add_task(&mut tasks, " Learn Rust "), Ok(1));
        assert_eq!(add_task(&mut tasks, "Write tests"), Ok(2));
        complete_task(&mut tasks, 1).unwrap();
        complete_task(&mut tasks, 1).unwrap();
        assert!(tasks[0].done);
        assert_eq!(tasks[0].title, "Learn Rust");
        assert!(complete_task(&mut tasks, 99).is_err());
    }
    #[test]
    fn rejects_invalid_titles() {
        for title in ["", "   ", "a\nb", "a\rb", "a\tb"] {
            assert!(add_task(&mut Vec::new(), title).is_err());
        }
        assert!(is_valid_title("Học Rust 🦀"));
    }
    #[test]
    fn round_trip_preserves_unicode_and_status() {
        let tasks = vec![Task { id: 2, title: "Học Rust 🦀".into(), done: true }];
        assert_eq!(parse_tasks(&serialize_tasks(&tasks)).unwrap(), tasks);
    }
    #[test]
    fn rejects_corrupt_data_without_silently_dropping_tasks() {
        for input in ["bad", "1\t2\tbad", "x\t0\ttitle", "0\t0\ttitle", "1\t0\t", "1\t0\ta\n1\t0\tb"] {
            assert!(parse_tasks(input).is_err(), "accepted {input}");
        }
    }
    #[test]
    fn persists_to_disk() {
        let path = std::env::temp_dir().join(format!("corelia-tasks-{}.tsv", std::process::id()));
        let _ = fs::remove_file(&path);
        let mut tasks = load_tasks(&path).unwrap();
        add_task(&mut tasks, "Ship a project").unwrap();
        save_tasks(&path, &tasks).unwrap();
        assert_eq!(load_tasks(&path).unwrap(), tasks);
        fs::remove_file(path).unwrap();
    }
    #[test]
    fn id_overflow_preserves_existing_tasks() {
        let mut tasks = vec![Task { id: u64::MAX, title: "Last".into(), done: false }];
        assert!(add_task(&mut tasks, "New").is_err());
        assert_eq!(tasks.len(), 1);
    }
}
