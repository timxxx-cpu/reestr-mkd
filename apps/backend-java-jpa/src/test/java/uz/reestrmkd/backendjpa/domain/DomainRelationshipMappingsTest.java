package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class DomainRelationshipMappingsTest {

    @Test
    void project_to_core_aggregates_mappings_exist() throws Exception {
        assertOneToMany(ProjectEntity.class, "buildings", "project");
        assertOneToMany(ProjectEntity.class, "applications", "project");
        assertOneToMany(ProjectEntity.class, "participants", "project");
        assertOneToMany(ProjectEntity.class, "documents", "project");
        assertOneToMany(ProjectEntity.class, "geometryCandidates", "project");
    }

    @Test
    void application_workflow_mappings_exist() throws Exception {
        assertManyToOne(ApplicationEntity.class, "project");
        assertOneToMany(ApplicationEntity.class, "steps", "application");
        assertOneToMany(ApplicationEntity.class, "history", "application");
        assertOneToOne(ApplicationEntity.class, "lock", "application");
        assertOneToMany(ApplicationEntity.class, "lockAudit", "application");
        assertOneToMany(ApplicationEntity.class, "versions", "application");
    }

    @Test
    void block_registry_mappings_exist() throws Exception {
        assertOneToMany(BuildingBlockEntity.class, "floors", "block");
        assertOneToMany(BuildingBlockEntity.class, "entrances", "block");
        assertOneToMany(BuildingBlockEntity.class, "floorMarkers", "block");
        assertOneToMany(BuildingBlockEntity.class, "entranceMatrix", "block");
        assertOneToMany(BuildingBlockEntity.class, "extensions", "parentBlock");
        assertOneToOne(BuildingBlockEntity.class, "construction", "block");
        assertOneToOne(BuildingBlockEntity.class, "engineering", "block");
    }

    @Test
    void extension_and_entrance_mappings_exist() throws Exception {
        assertManyToOne(FloorEntity.class, "extension");
        assertManyToOne(UnitEntity.class, "extension");
        assertManyToOne(UnitEntity.class, "entrance");
        assertOneToMany(BlockExtensionEntity.class, "floors", "extension");
        assertOneToMany(BlockExtensionEntity.class, "units", "extension");
        assertOneToMany(EntranceEntity.class, "units", "entrance");
        assertOneToMany(EntranceEntity.class, "commonAreas", "entrance");
    }


    @Test
    void compatibility_join_columns_are_read_only() throws Exception {
        assertJoinColumnReadOnly(ApplicationEntity.class, "project", "project_id");
        assertJoinColumnReadOnly(UnitEntity.class, "floor", "floor_id");
        assertJoinColumnReadOnly(UnitEntity.class, "entrance", "entrance_id");
        assertJoinColumnReadOnly(UnitEntity.class, "extension", "extension_id");
        assertJoinColumnReadOnly(FloorEntity.class, "block", "block_id");
        assertJoinColumnReadOnly(FloorEntity.class, "extension", "extension_id");
        assertJoinColumnReadOnly(BlockExtensionEntity.class, "parentBlock", "parent_block_id");
        assertJoinColumnReadOnly(ProjectGeometryCandidateEntity.class, "assignedBuilding", "assigned_building_id");
    }

    private static void assertManyToOne(Class<?> type, String fieldName) throws Exception {
        Field field = type.getDeclaredField(fieldName);
        ManyToOne annotation = field.getAnnotation(ManyToOne.class);
        assertNotNull(annotation, () -> type.getSimpleName() + "." + fieldName + " must have @ManyToOne");
    }

    private static void assertOneToMany(Class<?> type, String fieldName, String mappedBy) throws Exception {
        Field field = type.getDeclaredField(fieldName);
        OneToMany annotation = field.getAnnotation(OneToMany.class);
        assertNotNull(annotation, () -> type.getSimpleName() + "." + fieldName + " must have @OneToMany");
        assertEquals(mappedBy, annotation.mappedBy(), () -> type.getSimpleName() + "." + fieldName + " mappedBy mismatch");
    }


    private static void assertJoinColumnReadOnly(Class<?> type, String fieldName, String expectedName) throws Exception {
        Field field = type.getDeclaredField(fieldName);
        JoinColumn annotation = field.getAnnotation(JoinColumn.class);
        assertNotNull(annotation, () -> type.getSimpleName() + "." + fieldName + " must have @JoinColumn");
        assertEquals(expectedName, annotation.name(), () -> type.getSimpleName() + "." + fieldName + " join column name mismatch");
        assertEquals(false, annotation.insertable(), () -> type.getSimpleName() + "." + fieldName + " must be insertable=false");
        assertEquals(false, annotation.updatable(), () -> type.getSimpleName() + "." + fieldName + " must be updatable=false");
    }

    private static void assertOneToOne(Class<?> type, String fieldName, String mappedBy) throws Exception {
        Field field = type.getDeclaredField(fieldName);
        OneToOne annotation = field.getAnnotation(OneToOne.class);
        assertNotNull(annotation, () -> type.getSimpleName() + "." + fieldName + " must have @OneToOne");
        assertEquals(mappedBy, annotation.mappedBy(), () -> type.getSimpleName() + "." + fieldName + " mappedBy mismatch");
    }
}
